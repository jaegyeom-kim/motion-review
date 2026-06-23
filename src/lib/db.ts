import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Asset, Branch, Version, Comment, LottieBlob, Project, ID } from '../types'

interface CommenterDB extends DBSchema {
  projects: {
    key: ID
    value: Project
  }
  assets: {
    key: ID
    value: Asset
    indexes: { byProject: ID }
  }
  branches: {
    key: ID
    value: Branch
    indexes: { byAsset: ID }
  }
  versions: {
    key: ID
    value: Version
    indexes: { byAsset: ID; byBranch: ID }
  }
  comments: {
    key: ID
    value: Comment
    indexes: { byAsset: ID; byVersion: ID }
  }
  blobs: {
    key: ID
    value: LottieBlob
  }
}

const DB_NAME = 'lottie-commenter'
const DB_VERSION = 2

/** Stable id of the default project created when migrating a v1 (Lottie-only)
 *  database, so existing assets get a home. */
export const DEFAULT_PROJECT_ID = 'project_default'

let dbPromise: Promise<IDBPDatabase<CommenterDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CommenterDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // --- v0 → v1: original Lottie-only schema. ---
        if (oldVersion < 1) {
          db.createObjectStore('assets', { keyPath: 'id' })

          const branches = db.createObjectStore('branches', { keyPath: 'id' })
          branches.createIndex('byAsset', 'assetId')

          const versions = db.createObjectStore('versions', { keyPath: 'id' })
          versions.createIndex('byAsset', 'assetId')
          versions.createIndex('byBranch', 'branchId')

          const comments = db.createObjectStore('comments', { keyPath: 'id' })
          comments.createIndex('byAsset', 'assetId')
          comments.createIndex('byVersion', 'versionId')

          db.createObjectStore('blobs', { keyPath: 'versionId' })
        }

        // --- v1 → v2: projects + multi-media. Additive; backfills in-tx. ---
        if (oldVersion < 2) {
          db.createObjectStore('projects', { keyPath: 'id' })
          const assetStore = tx.objectStore('assets')
          assetStore.createIndex('byProject', 'projectId')

          // Only existing (v1) databases have assets to rehome. A brand-new DB
          // (oldVersion 0) lets seedDemo create its own project, so skip here.
          if (oldVersion >= 1) {
            const t = Date.now()
            tx.objectStore('projects').put({
              id: DEFAULT_PROJECT_ID,
              name: '내 프로젝트',
              description: '기존 애니메이션',
              createdAt: t,
              updatedAt: t,
              color: '#7c6cff',
              order: 0,
            })
            // Backfill assets: home them, mark as lottie, set review status.
            for (const a of await assetStore.getAll()) {
              assetStore.put({
                ...a,
                projectId: a.projectId ?? DEFAULT_PROJECT_ID,
                kind: a.kind ?? 'lottie',
                status: a.status ?? 'in_review',
              })
            }
            // Backfill versions: tag kind so compare/renderers can dispatch.
            const verStore = tx.objectStore('versions')
            for (const v of await verStore.getAll()) {
              if (!v.kind) verStore.put({ ...v, kind: 'lottie' })
            }
          }
        }
      },
    })
  }
  return dbPromise
}

// ---- Projects ----
export async function getAllProjects(): Promise<Project[]> {
  return (await getDB()).getAll('projects')
}
export async function putProject(p: Project) {
  await (await getDB()).put('projects', p)
}
/** Delete a project and cascade-delete every asset (and its graph) inside it. */
export async function deleteProjectCascade(projectId: ID) {
  const db = await getDB()
  const assetIds = await db.getAllKeysFromIndex('assets', 'byProject', projectId)
  for (const id of assetIds) await deleteAssetCascade(id as ID)
  await db.delete('projects', projectId)
}

// ---- Assets ----
export async function getAllAssets(): Promise<Asset[]> {
  return (await getDB()).getAll('assets')
}
export async function putAsset(a: Asset) {
  await (await getDB()).put('assets', a)
}
export async function deleteAssetCascade(assetId: ID) {
  const db = await getDB()
  const tx = db.transaction(
    ['assets', 'branches', 'versions', 'comments', 'blobs'],
    'readwrite',
  )
  const versionIds = (
    await tx.objectStore('versions').index('byAsset').getAllKeys(assetId)
  ) as ID[]
  await tx.objectStore('assets').delete(assetId)
  for (const b of await tx.objectStore('branches').index('byAsset').getAllKeys(assetId))
    await tx.objectStore('branches').delete(b)
  for (const v of versionIds) {
    await tx.objectStore('versions').delete(v)
    await tx.objectStore('blobs').delete(v)
  }
  for (const c of await tx.objectStore('comments').index('byAsset').getAllKeys(assetId))
    await tx.objectStore('comments').delete(c)
  await tx.done
}

// ---- Branches ----
export async function getBranches(assetId: ID): Promise<Branch[]> {
  return (await getDB()).getAllFromIndex('branches', 'byAsset', assetId)
}
export async function putBranch(b: Branch) {
  await (await getDB()).put('branches', b)
}

// ---- Versions ----
export async function getVersions(assetId: ID): Promise<Version[]> {
  return (await getDB()).getAllFromIndex('versions', 'byAsset', assetId)
}
export async function putVersion(v: Version) {
  await (await getDB()).put('versions', v)
}

// ---- Comments ----
export async function getComments(assetId: ID): Promise<Comment[]> {
  return (await getDB()).getAllFromIndex('comments', 'byAsset', assetId)
}
export async function putComment(c: Comment) {
  await (await getDB()).put('comments', c)
}
export async function deleteComment(id: ID) {
  await (await getDB()).delete('comments', id)
}

// ---- Blobs (heavy animation JSON, loaded on demand) ----
export async function putBlob(blob: LottieBlob) {
  await (await getDB()).put('blobs', blob)
}
export async function getBlob(versionId: ID): Promise<LottieBlob | undefined> {
  return (await getDB()).get('blobs', versionId)
}

/** Atomically write a whole imported asset graph in one transaction so a
 *  failure mid-way leaves the DB untouched (no half-imported asset). */
export async function importAll(payload: {
  asset: Asset
  project?: Project
  branches: Branch[]
  versions: Version[]
  comments: Comment[]
  blobs: LottieBlob[]
}) {
  const db = await getDB()
  const tx = db.transaction(
    ['projects', 'assets', 'branches', 'versions', 'comments', 'blobs'],
    'readwrite',
  )
  if (payload.project) await tx.objectStore('projects').put(payload.project)
  await tx.objectStore('assets').put(payload.asset)
  for (const b of payload.branches) await tx.objectStore('branches').put(b)
  for (const v of payload.versions) await tx.objectStore('versions').put(v)
  for (const c of payload.comments) await tx.objectStore('comments').put(c)
  for (const blob of payload.blobs) await tx.objectStore('blobs').put(blob)
  await tx.done
}

/** Wipe everything — used by "reset demo data". */
export async function clearAll() {
  const db = await getDB()
  const tx = db.transaction(
    ['projects', 'assets', 'branches', 'versions', 'comments', 'blobs'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('projects').clear(),
    tx.objectStore('assets').clear(),
    tx.objectStore('branches').clear(),
    tx.objectStore('versions').clear(),
    tx.objectStore('comments').clear(),
    tx.objectStore('blobs').clear(),
  ])
  await tx.done
}
