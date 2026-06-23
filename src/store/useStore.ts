import { create } from 'zustand'
import type {
  Asset,
  AssetStatus,
  Branch,
  Version,
  Comment,
  CommentStatus,
  CommentTag,
  Project,
  ID,
  Reply,
} from '../types'
import * as db from '../lib/backend'
import { supabase, cloudEnabled } from '../lib/supabase'
import { newId } from '../lib/ids'
import { renderThumbnail, cloneAnimationData } from '../lib/lottie'
import { parseMedia } from '../lib/media'
import { makeDemoLottie } from '../lib/demoLottie'
import { makeDemoPosterSvg } from '../lib/demoMedia'

export const BRANCH_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
]

/** Palette a commenter picks their bubble color from. */
export const IDENTITY_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
  '#c98aff',
  '#ff5c6c',
  '#4ad0e0',
]

/** Accent palette for project cards. */
export const PROJECT_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
  '#c98aff',
]

const IDENTITY_KEY = 'lc-identity'

function loadIdentity(): { author: string; authorColor: string } {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.author === 'string' && typeof p.authorColor === 'string')
        return { author: p.author, authorColor: p.authorColor }
    }
  } catch {
    /* ignore */
  }
  return { author: 'You', authorColor: IDENTITY_COLORS[0] }
}

export interface DraftPin {
  frame: number
  x: number
  y: number
  layerName?: string
}

interface Filters {
  status: CommentStatus | 'all'
  tag: CommentTag | 'all'
}

interface State {
  ready: boolean
  author: string
  authorColor: string

  // global
  projects: Project[]
  assets: Asset[]

  // project navigation
  currentProjectId: ID | null

  // current-asset working set
  currentAssetId: ID | null
  branches: Branch[]
  versions: Version[]
  comments: Comment[]
  animCache: Record<ID, unknown>

  // ui
  currentBranchId: ID | null
  currentVersionId: ID | null
  compareVersionId: ID | null
  selectedCommentId: ID | null
  draftPin: DraftPin | null
  placingPin: boolean
  filters: Filters

  // identity
  setIdentity: (name: string, color: string) => void

  // lifecycle
  init: () => Promise<void>
  seedDemo: () => Promise<void>
  resetAll: () => Promise<void>
  reloadAssets: () => Promise<void>
  startRealtime: () => void

  // projects
  createProject: (name: string, description?: string) => Promise<ID>
  renameProject: (id: ID, name: string, description?: string) => Promise<void>
  deleteProject: (id: ID) => Promise<void>
  setCurrentProject: (id: ID | null) => void

  // assets
  createAsset: (file: File, name: string, message: string, projectId: ID) => Promise<ID>
  openAsset: (assetId: ID) => Promise<void>
  closeAsset: () => void
  deleteAsset: (assetId: ID) => Promise<void>
  setAssetStatus: (assetId: ID, status: AssetStatus) => Promise<void>
  renameAsset: (assetId: ID, name: string) => Promise<void>
  moveAsset: (assetId: ID, projectId: ID) => Promise<void>

  // versions
  addVersion: (file: File, message: string, branchId: ID) => Promise<ID>
  setCurrentVersion: (versionId: ID) => void
  approveVersion: (versionId: ID, approved: boolean) => Promise<void>
  ensureAnim: (versionId: ID) => Promise<unknown | null>
  ensureMediaFile: (versionId: ID) => Promise<Blob | null>

  // branches
  createBranch: (name: string, fromVersionId: ID) => Promise<ID>
  setCurrentBranch: (branchId: ID) => void

  // compare
  setCompare: (versionId: ID | null) => void

  // comments
  setPlacingPin: (on: boolean) => void
  setDraftPin: (d: DraftPin | null) => void
  addComment: (input: {
    body: string
    tag: CommentTag
    frame: number
    x: number
    y: number
    layerName?: string
  }) => Promise<void>
  updateCommentBody: (id: ID, body: string) => Promise<void>
  movePin: (id: ID, x: number, y: number) => void
  setCommentStatus: (id: ID, status: CommentStatus) => Promise<void>
  setCommentTag: (id: ID, tag: CommentTag) => Promise<void>
  addReply: (commentId: ID, body: string) => Promise<void>
  removeComment: (id: ID) => Promise<void>
  selectComment: (id: ID | null) => void

  // filters
  setFilters: (f: Partial<Filters>) => void
}

const now = () => Date.now()

// Guards against React StrictMode's double-invoked init effect seeding twice.
let initOnce: Promise<void> | null = null
// Single shared realtime channel (cloud mode).
let rtChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

export const useStore = create<State>((set, get) => ({
  ready: false,
  ...loadIdentity(),
  projects: [],
  assets: [],
  currentProjectId: null,
  currentAssetId: null,
  branches: [],
  versions: [],
  comments: [],
  animCache: {},
  currentBranchId: null,
  currentVersionId: null,
  compareVersionId: null,
  selectedCommentId: null,
  draftPin: null,
  placingPin: false,
  filters: { status: 'all', tag: 'all' },

  setIdentity: (name, color) => {
    const author = name.trim() || 'You'
    set({ author, authorColor: color })
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify({ author, authorColor: color }))
    } catch {
      /* ignore */
    }
  },

  init: async () => {
    if (initOnce) return initOnce
    initOnce = (async () => {
      const assets = await db.getAllAssets()
      // Only auto-seed demo data in LOCAL mode. The shared cloud workspace
      // starts empty (or already has whatever teammates uploaded).
      if (!cloudEnabled && assets.length === 0) {
        await get().seedDemo()
      }
      set({
        projects: await db.getAllProjects(),
        assets: await db.getAllAssets(),
        ready: true,
      })
      if (cloudEnabled) get().startRealtime()
    })().catch((e) => {
      // Don't memoize a rejected init — allow a later retry.
      initOnce = null
      throw e
    })
    return initOnce
  },

  seedDemo: async () => {
    try {
      const projectId = newId('project')
      const assetId = newId('asset')
      const mainId = newId('branch')
      const t0 = now()

      const project: Project = {
        id: projectId,
        name: '브랜드 리뷰',
        description: 'Lottie · 이미지 · 영상 한곳에서 리뷰',
        createdAt: t0,
        updatedAt: t0,
        color: PROJECT_COLORS[0],
        order: 0,
      }

      const v1Data = makeDemoLottie({
        name: 'Loader v1',
        color: [0.486, 0.423, 1],
        accent: [0.486, 0.423, 1],
        spinFrames: 90,
        squash: 0.2,
      })
      const v2Data = makeDemoLottie({
        name: 'Loader v2',
        color: [0.227, 0.819, 0.768],
        accent: [0.486, 0.423, 1],
        spinFrames: 60,
        squash: 0.45,
      })

      const main: Branch = {
        id: mainId,
        assetId,
        name: 'main',
        parentBranchId: null,
        forkedFromVersionId: null,
        createdAt: t0,
        isDefault: true,
        color: BRANCH_COLORS[0],
        status: 'active',
      }

      const mkVersion = (
        data: ReturnType<typeof makeDemoLottie>,
        num: number,
        msg: string,
        parent: ID | null,
        approved = false,
      ): Version => {
        const id = newId('ver')
        return {
          id,
          assetId,
          branchId: mainId,
          number: num,
          globalNumber: num,
          message: msg,
          createdAt: t0 + num * 60000,
          author: 'Sohee',
          parentVersionId: parent,
          kind: 'lottie',
          approved,
          meta: {
            width: data.w,
            height: data.h,
            frameRate: data.fr,
            inPoint: data.ip,
            outPoint: data.op,
            totalFrames: data.op - data.ip,
            durationSec: (data.op - data.ip) / data.fr,
            layerCount: data.layers.length,
            layerNames: data.layers.map((l) => l.nm),
            fileName: `loader-v${num}.json`,
            fileSize: JSON.stringify(data).length,
            bodymovinVersion: data.v,
          },
        }
      }

      const v1 = mkVersion(v1Data, 1, '최초 로더 — 회전 링 + 바운스 코어', null, true)
      const v2 = mkVersion(v2Data, 2, '스핀 속도 ↑, 스쿼시 강조', v1.id)

      const thumb = await renderThumbnail(v2Data)

      const asset: Asset = {
        id: assetId,
        name: '로딩 스피너',
        description: '제품 전반에서 쓰는 로딩 애니메이션',
        createdAt: t0,
        updatedAt: v2.createdAt,
        defaultBranchId: mainId,
        thumbnail: thumb,
        projectId,
        kind: 'lottie',
        status: 'in_review',
      }

      await db.putProject(project)
      await db.putAsset(asset)
      await db.putBranch(main)
      await db.putVersion(v1)
      await db.putVersion(v2)
      await db.putBlob({ versionId: v1.id, data: v1Data, kind: 'lottie' })
      await db.putBlob({ versionId: v2.id, data: v2Data, kind: 'lottie' })

      const c = (
        body: string,
        tag: CommentTag,
        status: CommentStatus,
        frame: number,
        x: number,
        y: number,
        n: number,
        layerName?: string,
      ): Comment => ({
        id: newId('cmt'),
        assetId,
        versionId: v2.id,
        number: n,
        frame,
        x,
        y,
        layerName,
        body,
        tag,
        status,
        author: 'Jiwon',
        authorColor: '#3ad1c4',
        createdAt: t0 + 120000 + n * 1000,
        updatedAt: t0 + 120000 + n * 1000,
        replies: [],
      })

      await db.putComment(
        c('링 회전이 살짝 끊겨요. 이징 한번 더 봐주세요.', 'easing', 'open', 18, 0.5, 0.22, 1, 'Ring'),
      )
      await db.putComment(
        c('코어 바운스가 너무 과해요. 스쿼시 30%로?', 'timing', 'in_progress', 30, 0.5, 0.62, 2, 'Core'),
      )
      await db.putComment(
        c('글로우 색 브랜드 퍼플로 통일했으면.', 'color', 'open', 30, 0.74, 0.74, 3, 'Glow'),
      )

      // A demo IMAGE asset in the same project, to show multi-kind review.
      try {
        const imgFile = new File([makeDemoPosterSvg()], 'key-visual.svg', {
          type: 'image/svg+xml',
        })
        const parsed = await parseMedia(imgFile)
        const imgAssetId = newId('asset')
        const imgBranchId = newId('branch')
        const imgVerId = newId('ver')
        const imgBranch: Branch = {
          id: imgBranchId,
          assetId: imgAssetId,
          name: 'main',
          parentBranchId: null,
          forkedFromVersionId: null,
          createdAt: t0 + 5000,
          isDefault: true,
          color: BRANCH_COLORS[0],
          status: 'active',
        }
        const imgVer: Version = {
          id: imgVerId,
          assetId: imgAssetId,
          branchId: imgBranchId,
          number: 1,
          globalNumber: 1,
          message: '키 비주얼 시안',
          createdAt: t0 + 5000,
          author: 'Sohee',
          parentVersionId: null,
          kind: 'image',
          approved: false,
          meta: parsed.meta,
        }
        const imgAsset: Asset = {
          id: imgAssetId,
          name: '키 비주얼',
          description: '캠페인 메인 이미지',
          createdAt: t0 + 5000,
          updatedAt: t0 + 5000,
          defaultBranchId: imgBranchId,
          thumbnail: parsed.thumbnail,
          projectId,
          kind: 'image',
          status: 'needs_changes',
        }
        await db.putAsset(imgAsset)
        await db.putBranch(imgBranch)
        await db.putVersion(imgVer)
        await db.putBlob({ versionId: imgVerId, file: imgFile, kind: 'image' })
        await db.putComment({
          id: newId('cmt'),
          assetId: imgAssetId,
          versionId: imgVerId,
          number: 1,
          frame: 0,
          x: 0.32,
          y: 0.4,
          body: '타이틀 자간을 조금 좁혀주세요.',
          tag: 'shape',
          status: 'open',
          author: 'Jiwon',
          authorColor: '#3ad1c4',
          createdAt: t0 + 130000,
          updatedAt: t0 + 130000,
          replies: [],
        })
      } catch (e) {
        console.warn('demo image seed failed', e)
      }
    } catch (e) {
      // Demo seed is best-effort; never let it block app start.
      console.warn('seedDemo failed', e)
    }
  },

  reloadAssets: async () => {
    set({ projects: await db.getAllProjects(), assets: await db.getAllAssets() })
  },

  resetAll: async () => {
    await db.clearAll()
    set({
      projects: [],
      assets: [],
      currentProjectId: null,
      currentAssetId: null,
      branches: [],
      versions: [],
      comments: [],
      animCache: {},
      currentBranchId: null,
      currentVersionId: null,
      compareVersionId: null,
      selectedCommentId: null,
      draftPin: null,
      placingPin: false,
    })
    if (!cloudEnabled) await get().seedDemo()
    set({ projects: await db.getAllProjects(), assets: await db.getAllAssets() })
  },

  startRealtime: () => {
    if (!cloudEnabled || !supabase || rtChannel) return
    const reloadGrid = () => {
      void (async () => {
        set({ projects: await db.getAllProjects(), assets: await db.getAllAssets() })
      })()
    }
    const reloadComments = () => {
      const aid = get().currentAssetId
      if (aid) void db.getComments(aid).then((comments) => set({ comments }))
    }
    const reloadGraph = () => {
      const aid = get().currentAssetId
      if (!aid) return
      void Promise.all([db.getBranches(aid), db.getVersions(aid)]).then(([branches, versions]) =>
        set({ branches, versions }),
      )
    }
    rtChannel = supabase
      .channel('motion-review')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, reloadGrid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, reloadGrid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, reloadComments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'versions' }, reloadGraph)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, reloadGraph)
      .subscribe()
  },

  // ---- projects ----
  createProject: async (name, description) => {
    const t = now()
    const order =
      get().projects.reduce((m, p) => Math.max(m, p.order), -1) + 1
    const project: Project = {
      id: newId('project'),
      name: name.trim() || '새 프로젝트',
      description: description?.trim() || undefined,
      createdAt: t,
      updatedAt: t,
      color: PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length],
      order,
    }
    await db.putProject(project)
    set((s) => ({ projects: [...s.projects, project] }))
    return project.id
  },

  renameProject: async (id, name, description) => {
    const p = get().projects.find((x) => x.id === id)
    if (!p) return
    const updated: Project = {
      ...p,
      name: name.trim() || p.name,
      description: description === undefined ? p.description : description.trim() || undefined,
      updatedAt: now(),
    }
    await db.putProject(updated)
    set((s) => ({ projects: s.projects.map((x) => (x.id === id ? updated : x)) }))
  },

  deleteProject: async (id) => {
    await db.deleteProjectCascade(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      assets: s.assets.filter((a) => a.projectId !== id),
      currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
    }))
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  createAsset: async (file, name, message, projectId) => {
    const { kind, data, meta, thumbnail } = await parseMedia(file)
    const assetId = newId('asset')
    const branchId = newId('branch')
    const versionId = newId('ver')
    const t = now()

    const branch: Branch = {
      id: branchId,
      assetId,
      name: 'main',
      parentBranchId: null,
      forkedFromVersionId: null,
      createdAt: t,
      isDefault: true,
      color: BRANCH_COLORS[0],
      status: 'active',
    }
    const version: Version = {
      id: versionId,
      assetId,
      branchId,
      number: 1,
      globalNumber: 1,
      message: message || '최초 버전',
      createdAt: t,
      author: get().author,
      parentVersionId: null,
      kind,
      approved: false,
      meta,
    }
    const asset: Asset = {
      id: assetId,
      name: name || meta.fileName.replace(/\.[^.]+$/i, ''),
      createdAt: t,
      updatedAt: t,
      defaultBranchId: branchId,
      thumbnail: thumbnail || undefined,
      projectId,
      kind,
      status: 'in_review',
    }

    await db.putAsset(asset)
    await db.putBranch(branch)
    await db.putVersion(version)
    await db.putBlob(
      kind === 'lottie' ? { versionId, data, kind } : { versionId, file, kind },
    )
    set((s) => ({ assets: [...s.assets, asset] }))
    return assetId
  },

  openAsset: async (assetId) => {
    const [branches, versions, comments] = await Promise.all([
      db.getBranches(assetId),
      db.getVersions(assetId),
      db.getComments(assetId),
    ])
    const asset = get().assets.find((a) => a.id === assetId)
    const defaultBranchId = asset?.defaultBranchId ?? branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? null
    const latest = latestOnBranch(versions, defaultBranchId)
    set({
      currentAssetId: assetId,
      currentProjectId: asset?.projectId ?? get().currentProjectId,
      branches,
      versions,
      comments,
      animCache: {},
      currentBranchId: defaultBranchId,
      currentVersionId: latest?.id ?? null,
      compareVersionId: null,
      selectedCommentId: null,
      draftPin: null,
      placingPin: false,
      filters: { status: 'all', tag: 'all' },
    })
  },

  closeAsset: () =>
    set({
      currentAssetId: null,
      branches: [],
      versions: [],
      comments: [],
      animCache: {},
      currentBranchId: null,
      currentVersionId: null,
      compareVersionId: null,
      selectedCommentId: null,
      draftPin: null,
      placingPin: false,
    }),

  deleteAsset: async (assetId) => {
    await db.deleteAssetCascade(assetId)
    set({ assets: get().assets.filter((a) => a.id !== assetId) })
    if (get().currentAssetId === assetId) get().closeAsset()
  },

  setAssetStatus: async (assetId, status) => {
    await patchAsset(set, get, assetId, (a) => ({ ...a, status, updatedAt: now() }))
  },
  renameAsset: async (assetId, name) => {
    const n = name.trim()
    if (!n) return
    await patchAsset(set, get, assetId, (a) => ({ ...a, name: n, updatedAt: now() }))
  },
  moveAsset: async (assetId, projectId) => {
    await patchAsset(set, get, assetId, (a) => ({ ...a, projectId, updatedAt: now() }))
  },

  addVersion: async (file, message, branchId) => {
    // Do all awaits (parse + thumbnail) BEFORE touching state, so numbering and
    // the append happen in one synchronous critical section — no lost updates.
    const openAssetId = get().currentAssetId
    if (!openAssetId) throw new Error('no asset open')
    const assetKind = get().assets.find((a) => a.id === openAssetId)?.kind
    const { kind, data, meta, thumbnail } = await parseMedia(file)
    // Every version of an asset shares its kind, so renderers/compare can
    // dispatch on a single kind. Reject a mismatched re-upload.
    if (assetKind && kind !== assetKind) {
      throw new Error(
        `이 애셋은 ${assetKind} 형식입니다. 같은 형식의 파일만 새 버전으로 추가할 수 있어요.`,
      )
    }
    const thumb = thumbnail
    const currentAssetId = openAssetId
    const fresh = get()
    const branchVersions = fresh.versions.filter((v) => v.branchId === branchId)
    const parent = latestOnBranch(fresh.versions, branchId)
    const versionId = newId('ver')
    const t = now()
    const version: Version = {
      id: versionId,
      assetId: currentAssetId,
      branchId,
      number: branchVersions.length + 1,
      globalNumber: fresh.versions.length + 1,
      message: message || `v${branchVersions.length + 1}`,
      createdAt: t,
      author: fresh.author,
      parentVersionId: parent?.id ?? null,
      kind,
      approved: false,
      meta,
    }
    const asset = fresh.assets.find((a) => a.id === currentAssetId)
    const updatedAsset = asset
      ? { ...asset, updatedAt: t, thumbnail: thumb || asset.thumbnail }
      : null

    set((s) => ({
      versions: [...s.versions, version],
      currentVersionId: versionId,
      currentBranchId: branchId,
      // Only cache parsed Lottie JSON (small). Never cache raw media bytes.
      animCache: kind === 'lottie' ? { ...s.animCache, [versionId]: data } : s.animCache,
      assets: updatedAsset
        ? s.assets.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
        : s.assets,
    }))

    await db.putVersion(version)
    await db.putBlob(
      kind === 'lottie' ? { versionId, data, kind } : { versionId, file, kind },
    )
    if (updatedAsset) await db.putAsset(updatedAsset)
    return versionId
  },

  setCurrentVersion: (versionId) =>
    set({ currentVersionId: versionId, selectedCommentId: null, placingPin: false, draftPin: null }),

  approveVersion: async (versionId, approved) => {
    const v = get().versions.find((x) => x.id === versionId)
    if (!v) return
    const updated = { ...v, approved }
    await db.putVersion(updated)
    set({ versions: get().versions.map((x) => (x.id === versionId ? updated : x)) })
  },

  ensureAnim: async (versionId) => {
    const cached = get().animCache[versionId]
    if (cached) return cached
    const blob = await db.getBlob(versionId)
    if (!blob || blob.data == null) return null
    // Only parsed Lottie JSON is cached in-store; raw media bytes are not.
    set({ animCache: { ...get().animCache, [versionId]: blob.data } })
    return blob.data
  },

  ensureMediaFile: async (versionId) => {
    const blob = await db.getBlob(versionId)
    return blob?.file ?? null
  },

  createBranch: async (name, fromVersionId) => {
    if (!get().currentAssetId) throw new Error('no asset open')
    if (!get().versions.some((v) => v.id === fromVersionId))
      throw new Error('source version missing')

    // The only await — fetch the fork-point blob — happens BEFORE reading state
    // for numbering, so the append below is a synchronous critical section.
    const srcBlob = await db.getBlob(fromVersionId)

    const currentAssetId = get().currentAssetId!
    const fresh = get()
    const from = fresh.versions.find((v) => v.id === fromVersionId)!
    const branchId = newId('branch')
    const versionId = newId('ver')
    const t = now()
    const branch: Branch = {
      id: branchId,
      assetId: currentAssetId,
      name,
      parentBranchId: from.branchId,
      forkedFromVersionId: fromVersionId,
      createdAt: t,
      isDefault: false,
      color: BRANCH_COLORS[fresh.branches.length % BRANCH_COLORS.length],
      status: 'active',
    }
    // Seed the branch with a copy of the fork-point version so it has a base
    // to view and diff against — like checking out a commit onto a new branch.
    const seed: Version = {
      id: versionId,
      assetId: currentAssetId,
      branchId,
      number: 1,
      globalNumber: fresh.versions.length + 1,
      message: `'${name}' 브랜치 시작 (v${from.globalNumber}에서 분기)`,
      createdAt: t,
      author: fresh.author,
      parentVersionId: fromVersionId,
      kind: from.kind,
      approved: false,
      meta: { ...from.meta },
    }

    set((s) => ({
      branches: [...s.branches, branch],
      versions: [...s.versions, seed],
      currentBranchId: branchId,
      currentVersionId: versionId,
      compareVersionId: null,
      selectedCommentId: null,
    }))

    await db.putBranch(branch)
    await db.putVersion(seed)
    if (srcBlob) await db.putBlob({ versionId, data: cloneAnimationData(srcBlob.data) })
    return branchId
  },

  setCurrentBranch: (branchId) => {
    const latest = latestOnBranch(get().versions, branchId)
    set({
      currentBranchId: branchId,
      currentVersionId: latest?.id ?? null,
      compareVersionId: null,
      selectedCommentId: null,
      placingPin: false,
      draftPin: null,
    })
  },

  setCompare: (versionId) => set({ compareVersionId: versionId }),

  setPlacingPin: (on) => set({ placingPin: on, draftPin: on ? get().draftPin : null }),
  setDraftPin: (d) => set({ draftPin: d }),

  addComment: async (input) => {
    const { currentVersionId, currentAssetId, author, authorColor } = get()
    if (!currentVersionId || !currentAssetId) return
    const t = now()
    const comment: Comment = {
      id: newId('cmt'),
      assetId: currentAssetId,
      versionId: currentVersionId,
      number:
        get().comments.filter((c) => c.versionId === currentVersionId).length + 1,
      frame: input.frame,
      x: input.x,
      y: input.y,
      layerName: input.layerName,
      body: input.body,
      tag: input.tag,
      status: 'open',
      author,
      authorColor,
      createdAt: t,
      updatedAt: t,
      replies: [],
    }
    // Append from current state (functional updater) before persisting, so an
    // overlapping mutation can't clobber it.
    set((s) => ({
      comments: [...s.comments, comment],
      selectedCommentId: comment.id,
      placingPin: false,
      draftPin: null,
    }))
    await db.putComment(comment)
  },

  updateCommentBody: async (id, body) => {
    await patchComment(set, get, id, (c) => ({ ...c, body, updatedAt: now() }))
  },
  movePin: (id, x, y) => {
    // Update in-memory immediately for a smooth drag; persist the latest pos.
    let persisted: Comment | null = null
    set((s) => ({
      comments: s.comments.map((c) => {
        if (c.id !== id) return c
        persisted = { ...c, x, y }
        return persisted
      }),
    }))
    if (persisted) void db.putComment(persisted)
  },
  setCommentStatus: async (id, status) => {
    await patchComment(set, get, id, (c) => ({ ...c, status, updatedAt: now() }))
  },
  setCommentTag: async (id, tag) => {
    await patchComment(set, get, id, (c) => ({ ...c, tag, updatedAt: now() }))
  },
  addReply: async (commentId, body) => {
    const reply: Reply = {
      id: newId('rep'),
      author: get().author,
      authorColor: get().authorColor,
      body,
      createdAt: now(),
    }
    await patchComment(set, get, commentId, (c) => ({
      ...c,
      replies: [...c.replies, reply],
      updatedAt: now(),
    }))
  },
  removeComment: async (id) => {
    await db.deleteComment(id)
    set({
      comments: get().comments.filter((c) => c.id !== id),
      selectedCommentId: get().selectedCommentId === id ? null : get().selectedCommentId,
    })
  },
  selectComment: (id) => set({ selectedCommentId: id }),

  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
}))

// ---- helpers ----
function latestOnBranch(versions: Version[], branchId: ID | null): Version | null {
  if (!branchId) return null
  const onBranch = versions
    .filter((v) => v.branchId === branchId)
    .sort((a, b) => a.number - b.number)
  return onBranch[onBranch.length - 1] ?? null
}

async function patchComment(
  set: (updater: (s: State) => Partial<State>) => void,
  _get: () => State,
  id: ID,
  fn: (c: Comment) => Comment,
) {
  // Read + transform the latest comment INSIDE the updater so concurrent
  // mutators (status, tag, reply, body, move) compose instead of clobbering.
  let updated: Comment | null = null
  set((s) => {
    const target = s.comments.find((c) => c.id === id)
    if (!target) return {}
    updated = fn(target)
    return { comments: s.comments.map((c) => (c.id === id ? updated! : c)) }
  })
  if (updated) await db.putComment(updated)
}

async function patchAsset(
  set: (updater: (s: State) => Partial<State>) => void,
  _get: () => State,
  id: ID,
  fn: (a: Asset) => Asset,
) {
  let updated: Asset | null = null
  set((s) => {
    const target = s.assets.find((a) => a.id === id)
    if (!target) return {}
    updated = fn(target)
    return { assets: s.assets.map((a) => (a.id === id ? updated! : a)) }
  })
  if (updated) await db.putAsset(updated)
}

// ---- derived selectors (use inside components) ----
export const selectBranchVersions = (s: State, branchId: ID) =>
  s.versions.filter((v) => v.branchId === branchId).sort((a, b) => a.number - b.number)

export const selectVersionComments = (s: State, versionId: ID) =>
  s.comments
    .filter((c) => c.versionId === versionId)
    .sort((a, b) => a.number - b.number)

export const selectCurrentVersion = (s: State) =>
  s.versions.find((v) => v.id === s.currentVersionId) ?? null

export const selectCurrentBranch = (s: State) =>
  s.branches.find((b) => b.id === s.currentBranchId) ?? null

export const selectProjectAssets = (s: State, projectId: ID) =>
  s.assets.filter((a) => a.projectId === projectId)

export const selectCurrentProject = (s: State) =>
  s.projects.find((p) => p.id === s.currentProjectId) ?? null
