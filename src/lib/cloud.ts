import type { Asset, Branch, Version, Comment, LottieBlob, Project, ID } from '../types'
import { supabase, MEDIA_BUCKET } from './supabase'

// Cloud data layer (Supabase). Mirrors lib/db.ts's API exactly so the store
// can swap backends transparently. Rows are jsonb documents: `data` holds the
// full JS object; foreign keys are denormalized columns for filtering. Media
// lives in the public `media` Storage bucket, keyed by versionId.

const sb = () => {
  if (!supabase) throw new Error('cloud backend not configured')
  return supabase
}
const rows = <T>(data: { data: T }[] | null): T[] => (data ?? []).map((r) => r.data)

export const DEFAULT_PROJECT_ID = 'project_default'

// ---- Projects ----
export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await sb().from('projects').select('data')
  if (error) throw error
  return rows<Project>(data)
}
export async function putProject(p: Project) {
  const { error } = await sb().from('projects').upsert({ id: p.id, data: p })
  if (error) throw error
}

// ---- Assets ----
export async function getAllAssets(): Promise<Asset[]> {
  const { data, error } = await sb().from('assets').select('data')
  if (error) throw error
  return rows<Asset>(data)
}
export async function putAsset(a: Asset) {
  const { error } = await sb().from('assets').upsert({ id: a.id, project_id: a.projectId, data: a })
  if (error) throw error
}

// ---- Branches ----
export async function getBranches(assetId: ID): Promise<Branch[]> {
  const { data, error } = await sb().from('branches').select('data').eq('asset_id', assetId)
  if (error) throw error
  return rows<Branch>(data)
}
export async function putBranch(b: Branch) {
  const { error } = await sb().from('branches').upsert({ id: b.id, asset_id: b.assetId, data: b })
  if (error) throw error
}

// ---- Versions ----
export async function getVersions(assetId: ID): Promise<Version[]> {
  const { data, error } = await sb().from('versions').select('data').eq('asset_id', assetId)
  if (error) throw error
  return rows<Version>(data)
}
export async function putVersion(v: Version) {
  const { error } = await sb().from('versions').upsert({ id: v.id, asset_id: v.assetId, data: v })
  if (error) throw error
}

// ---- Comments ----
export async function getComments(assetId: ID): Promise<Comment[]> {
  const { data, error } = await sb().from('comments').select('data').eq('asset_id', assetId)
  if (error) throw error
  return rows<Comment>(data)
}
export async function putComment(c: Comment) {
  const { error } = await sb().from('comments').upsert({ id: c.id, asset_id: c.assetId, data: c })
  if (error) throw error
}
export async function deleteComment(id: ID) {
  const { error } = await sb().from('comments').delete().eq('id', id)
  if (error) throw error
}

// ---- Media blobs (Storage) ----
export async function putBlob(blob: LottieBlob) {
  const body =
    blob.data != null
      ? new Blob([JSON.stringify(blob.data)], { type: 'application/json' })
      : blob.file
  if (!body) return
  const { error } = await sb()
    .storage.from(MEDIA_BUCKET)
    .upload(blob.versionId, body, { upsert: true, contentType: (body as Blob).type || undefined })
  if (error) throw error
}
export async function getBlob(versionId: ID): Promise<LottieBlob | undefined> {
  // kind decides whether the stored bytes are parsed Lottie JSON or a raw file.
  const { data: vrow } = await sb()
    .from('versions')
    .select('data')
    .eq('id', versionId)
    .maybeSingle()
  const kind = (vrow?.data as Version | undefined)?.kind
  const { data: file, error } = await sb().storage.from(MEDIA_BUCKET).download(versionId)
  if (error || !file) return undefined
  if (kind === 'lottie') {
    try {
      return { versionId, data: JSON.parse(await file.text()), kind: 'lottie' }
    } catch {
      return undefined
    }
  }
  return { versionId, file, kind }
}

// ---- cascades ----
export async function deleteAssetCascade(assetId: ID) {
  const c = sb()
  const { data: vids } = await c.from('versions').select('id').eq('asset_id', assetId)
  const ids = (vids ?? []).map((r) => r.id as string)
  if (ids.length) await c.storage.from(MEDIA_BUCKET).remove(ids)
  await c.from('comments').delete().eq('asset_id', assetId)
  await c.from('versions').delete().eq('asset_id', assetId)
  await c.from('branches').delete().eq('asset_id', assetId)
  await c.from('assets').delete().eq('id', assetId)
}

export async function deleteProjectCascade(projectId: ID) {
  const c = sb()
  const { data: aids } = await c.from('assets').select('id').eq('project_id', projectId)
  for (const r of aids ?? []) await deleteAssetCascade(r.id as string)
  await c.from('projects').delete().eq('id', projectId)
}

// ---- atomic-ish bulk import ----
export async function importAll(payload: {
  asset: Asset
  project?: Project
  branches: Branch[]
  versions: Version[]
  comments: Comment[]
  blobs: LottieBlob[]
}) {
  if (payload.project) await putProject(payload.project)
  await putAsset(payload.asset)
  for (const b of payload.branches) await putBranch(b)
  for (const v of payload.versions) await putVersion(v)
  for (const c of payload.comments) await putComment(c)
  for (const blob of payload.blobs) await putBlob(blob)
}

// ---- wipe the shared workspace (reset button) ----
export async function clearAll() {
  const c = sb()
  // remove all media objects
  const { data: objs } = await c.storage.from(MEDIA_BUCKET).list('', { limit: 1000 })
  if (objs?.length) await c.storage.from(MEDIA_BUCKET).remove(objs.map((o) => o.name))
  for (const t of ['comments', 'versions', 'branches', 'assets', 'projects']) {
    await c.from(t).delete().neq('id', '__never__')
  }
}
