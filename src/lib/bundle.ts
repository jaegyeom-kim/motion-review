import { zip, strToU8 } from 'fflate'
import * as db from './backend'
import type { Asset, Branch, Version, Comment, Project, MediaKind } from '../types'
import { newId } from './ids'

const safe = (s: string) => s.replace(/[^\w가-힣-]+/g, '_')
const extOf = (fileName: string) => fileName.match(/\.[^.]+$/)?.[0] ?? ''

export interface ZipProgress {
  phase: 'collect' | 'compress' | 'done'
  done: number
  total: number
  label: string
}

/** Zip every file uploaded to a project — each asset's versions as their
 *  original files (Lottie → .json, others → raw bytes), foldered per asset,
 *  plus a manifest.json describing assets/versions/comments. Reports progress
 *  per file via `onProgress` so a modal can show it. Already-compressed media
 *  (image/video/pdf/audio) is stored (level 0); JSON is deflated. */
export async function exportProjectZip(
  projectId: string,
  onProgress: (p: ZipProgress) => void,
) {
  const [projects, allAssets] = await Promise.all([
    db.getAllProjects(),
    db.getAllAssets(),
  ])
  const project = projects.find((p) => p.id === projectId)
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.')
  const assets = allAssets.filter((a) => a.projectId === projectId)
  await zipAssets(assets, project.name, project, onProgress)
}

/** Download an asset's latest version as its raw file (no zip) — used when a
 *  single asset is selected. */
export async function exportAssetLatestFile(assetId: string) {
  const assets = await db.getAllAssets()
  const asset = assets.find((a) => a.id === assetId)
  if (!asset) throw new Error('애셋을 찾을 수 없습니다.')
  const versions = await db.getVersions(assetId)
  if (!versions.length) throw new Error('버전이 없습니다.')
  const latest = versions.reduce((a, b) => (b.globalNumber > a.globalNumber ? b : a))
  await exportVersion(latest, asset.name)
}

/** Zip only a chosen subset of assets (LottieFiles-style multi-select export). */
export async function exportAssetsZip(
  assetIds: string[],
  zipName: string,
  onProgress: (p: ZipProgress) => void,
) {
  const allAssets = await db.getAllAssets()
  const idSet = new Set(assetIds)
  const assets = allAssets.filter((a) => idSet.has(a.id))
  if (!assets.length) throw new Error('선택된 애셋이 없습니다.')
  await zipAssets(assets, zipName, null, onProgress)
}

/** Core: collect every version file of the given assets into a zip + manifest. */
async function zipAssets(
  assets: Asset[],
  zipName: string,
  project: Project | null,
  onProgress: (p: ZipProgress) => void,
) {
  const perAsset = await Promise.all(
    assets.map(async (a) => ({
      asset: a,
      versions: (await db.getVersions(a.id)).sort((x, y) => x.number - y.number),
      comments: await db.getComments(a.id),
    })),
  )
  const total = perAsset.reduce((n, x) => n + x.versions.length, 0)
  if (total === 0) throw new Error('내보낼 파일이 없습니다.')

  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  const usedFolders = new Set<string>()
  const manifest: Record<string, unknown> = {
    format: 'motion-review/project-zip',
    version: 1,
    project: project ? { name: project.name, description: project.description } : { name: zipName },
    assets: [],
  }
  let done = 0
  for (const { asset, versions, comments } of perAsset) {
    let folder = safe(asset.name) || asset.id
    let n = 2
    while (usedFolders.has(folder)) folder = `${safe(asset.name) || asset.id}_${n++}`
    usedFolders.add(folder)

    const assetEntry: Record<string, unknown> = {
      name: asset.name,
      kind: asset.kind,
      status: asset.status,
      versions: [] as unknown[],
      comments: comments.map((c) => ({
        versionGlobal: versions.find((v) => v.id === c.versionId)?.globalNumber,
        number: c.number,
        frame: c.frame,
        x: c.x,
        y: c.y,
        tag: c.tag,
        status: c.status,
        author: c.author,
        body: c.body,
        replies: c.replies.map((r) => ({ author: r.author, body: r.body })),
      })),
    }

    for (const v of versions) {
      onProgress({ phase: 'collect', done, total, label: `${asset.name} · v${v.globalNumber}` })
      const blob = await db.getBlob(v.id)
      let bytes: Uint8Array | null = null
      let ext = ''
      let level: 0 | 6 = 0
      if (v.kind === 'lottie' && blob?.data != null) {
        bytes = strToU8(JSON.stringify(blob.data))
        ext = '.json'
        level = 6
      } else if (blob?.file) {
        bytes = new Uint8Array(await blob.file.arrayBuffer())
        ext = extOf(v.meta.fileName) || ''
        level = 0
      }
      if (bytes) {
        const fname = `${folder}/v${v.globalNumber}${ext}`
        files[fname] = [bytes, { level }]
        ;(assetEntry.versions as unknown[]).push({
          globalNumber: v.globalNumber,
          message: v.message,
          file: fname,
          approved: v.approved,
        })
      }
      done++
    }
    ;(manifest.assets as unknown[]).push(assetEntry)
  }

  files['manifest.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }]

  onProgress({ phase: 'compress', done: total, total, label: '압축하는 중…' })
  const zipped = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, {}, (err, data) => (err ? reject(err) : resolve(data))),
  )
  downloadBytes(`${safe(zipName) || 'export'}.zip`, zipped, 'application/zip')
  onProgress({ phase: 'done', done: total, total, label: '완료' })
}

function downloadBytes(filename: string, bytes: Uint8Array, type: string) {
  // copy into a fresh ArrayBuffer-backed view so Blob gets a clean buffer
  const buf = bytes.slice()
  const url = URL.createObjectURL(new Blob([buf], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- Blob <-> data-URL (Blobs can't live in JSON) ----
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('파일 인코딩 실패'))
    r.readAsDataURL(blob)
  })
}
async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Download a single version's raw Lottie animation as a `.json` file. */
export async function exportVersionLottie(version: Version, assetName: string) {
  const blob = await db.getBlob(version.id)
  if (!blob?.data) return
  const base = safe(assetName || version.meta.fileName.replace(/\.(json|lottie)$/i, '') || 'lottie')
  download(`${base}_v${version.globalNumber}.json`, JSON.stringify(blob.data))
}

/** Download a version's original file regardless of kind: Lottie → .json,
 *  every other kind → its stored raw Blob with the original extension. */
export async function exportVersion(version: Version, assetName: string) {
  if (version.kind === 'lottie') return exportVersionLottie(version, assetName)
  const blob = await db.getBlob(version.id)
  if (!blob?.file) return
  const ext = version.meta.fileName.match(/\.[^.]+$/)?.[0] ?? ''
  const base = safe(assetName || version.meta.fileName.replace(/\.[^.]+$/i, '') || 'media')
  const url = URL.createObjectURL(blob.file)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}_v${version.globalNumber}${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface BundleBlob {
  versionId: string
  kind?: MediaKind
  /** parsed Lottie JSON (lottie kind). */
  data?: unknown
  /** base64 data-URL of the raw file (image/video/pdf/audio kinds). */
  fileB64?: string
}
interface Bundle {
  format: 'lottie-commenter/bundle'
  version: 1 | 2
  /** v2: the asset's project, recreated on import. */
  project?: Project
  asset: Asset
  branches: Branch[]
  versions: Version[]
  comments: Comment[]
  blobs: BundleBlob[]
}

/** Export one asset (with all branches/versions/comments/animation data) as a
 *  downloadable JSON bundle — backup + hand-off without a server. */
export async function exportAsset(assetId: string) {
  const [assets, projects] = await Promise.all([db.getAllAssets(), db.getAllProjects()])
  const asset = assets.find((a) => a.id === assetId)
  if (!asset) return
  const project = projects.find((p) => p.id === asset.projectId)
  const [branches, versions, comments] = await Promise.all([
    db.getBranches(assetId),
    db.getVersions(assetId),
    db.getComments(assetId),
  ])
  const blobs: BundleBlob[] = await Promise.all(
    versions.map(async (v) => {
      const b = await db.getBlob(v.id)
      if (b?.file) return { versionId: v.id, kind: b.kind ?? v.kind, fileB64: await blobToDataUrl(b.file) }
      return { versionId: v.id, kind: b?.kind ?? v.kind, data: b?.data }
    }),
  )
  const bundle: Bundle = {
    format: 'lottie-commenter/bundle',
    version: 2,
    project,
    asset,
    branches,
    versions,
    comments,
    blobs,
  }
  download(
    `${asset.name.replace(/[^\w가-힣-]+/g, '_')}.lcbundle.json`,
    JSON.stringify(bundle),
  )
}

/** Import a previously-exported bundle, remapping all ids so it never clashes
 *  with existing data. Validates shape + references, and writes atomically.
 *  Returns the new asset id. */
export async function importBundle(file: File): Promise<string> {
  let bundle: Bundle
  try {
    bundle = JSON.parse(await file.text()) as Bundle
  } catch {
    throw new Error('JSON 파싱 실패 — 손상된 파일.')
  }
  if (
    !bundle ||
    bundle.format !== 'lottie-commenter/bundle' ||
    typeof bundle.asset !== 'object' ||
    !bundle.asset ||
    !Array.isArray(bundle.branches) ||
    !Array.isArray(bundle.versions) ||
    !Array.isArray(bundle.comments) ||
    !Array.isArray(bundle.blobs)
  ) {
    throw new Error('올바른 번들 파일이 아닙니다.')
  }

  // Only remap references that actually exist in the bundle; drop dangling ones.
  const branchIds = new Set(bundle.branches.map((b) => b.id))
  const versionIds = new Set(bundle.versions.map((v) => v.id))

  const idMap = new Map<string, string>()
  const fresh = (oldId: string, prefix: string) => {
    if (!idMap.has(oldId)) idMap.set(oldId, newId(prefix))
    return idMap.get(oldId)!
  }
  const ref = (oldId: string | null | undefined, has: Set<string>, prefix: string) =>
    oldId && has.has(oldId) ? fresh(oldId, prefix) : null

  const t = Date.now()
  // Recreate the bundle's project (v2) or synthesize one (v1) so the imported
  // asset always has a home in the project-scoped UI.
  const project: Project = bundle.project
    ? {
        ...bundle.project,
        id: fresh(bundle.project.id, 'project'),
        name: `${bundle.project.name ?? '가져온 프로젝트'} (가져옴)`,
        updatedAt: t,
      }
    : {
        id: newId('project'),
        name: `${bundle.asset.name ?? '가져온 항목'} (가져옴)`,
        createdAt: t,
        updatedAt: t,
        color: '#7c6cff',
        order: 0,
      }

  // v1 assets predate kind/projectId/status — backfill as lottie.
  const assetKind: MediaKind = bundle.asset.kind ?? 'lottie'
  const asset: Asset = {
    ...bundle.asset,
    id: fresh(bundle.asset.id, 'asset'),
    name: `${bundle.asset.name ?? '가져온 애셋'} (가져옴)`,
    defaultBranchId: ref(bundle.asset.defaultBranchId, branchIds, 'branch') ?? '',
    projectId: project.id,
    kind: assetKind,
    status: bundle.asset.status ?? 'in_review',
  }
  const branches = bundle.branches.map((b) => ({
    ...b,
    id: fresh(b.id, 'branch'),
    assetId: asset.id,
    parentBranchId: ref(b.parentBranchId, branchIds, 'branch'),
    forkedFromVersionId: ref(b.forkedFromVersionId, versionIds, 'ver'),
  }))
  // Drop versions/comments whose required parent ref is missing from the bundle.
  const versions = bundle.versions
    .filter((v) => branchIds.has(v.branchId))
    .map((v) => ({
      ...v,
      id: fresh(v.id, 'ver'),
      assetId: asset.id,
      branchId: fresh(v.branchId, 'branch'),
      parentVersionId: ref(v.parentVersionId, versionIds, 'ver'),
      kind: v.kind ?? assetKind,
    }))
  const comments = bundle.comments
    .filter((c) => versionIds.has(c.versionId))
    .map((c) => ({
      ...c,
      id: fresh(c.id, 'cmt'),
      assetId: asset.id,
      versionId: fresh(c.versionId, 'ver'),
    }))
  const blobs = await Promise.all(
    bundle.blobs
      .filter((b) => versionIds.has(b.versionId) && (b.data != null || b.fileB64))
      .map(async (b) => {
        const versionId = fresh(b.versionId, 'ver')
        const kind = b.kind ?? assetKind
        if (b.fileB64) return { versionId, kind, file: await dataUrlToBlob(b.fileB64) }
        return { versionId, kind, data: b.data }
      }),
  )

  if (!asset.defaultBranchId)
    asset.defaultBranchId = branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? ''

  await db.importAll({ project, asset, branches, versions, comments, blobs })
  return asset.id
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke so the browser has started reading the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
