// Single data-layer entry point. Picks the Supabase cloud backend when
// configured (shared link-share workspace), else the local IndexedDB backend.
// Both modules expose an identical API so the store/preview/bundle code is
// backend-agnostic.
import { cloudEnabled } from './supabase'
import * as local from './db'
import * as cloud from './cloud'

const b = cloudEnabled ? cloud : local

export const DEFAULT_PROJECT_ID = b.DEFAULT_PROJECT_ID

export const getAllProjects = b.getAllProjects
export const putProject = b.putProject
export const deleteProjectCascade = b.deleteProjectCascade

export const getAllAssets = b.getAllAssets
export const putAsset = b.putAsset
export const deleteAssetCascade = b.deleteAssetCascade

export const getBranches = b.getBranches
export const putBranch = b.putBranch

export const getVersions = b.getVersions
export const putVersion = b.putVersion

export const getComments = b.getComments
export const putComment = b.putComment
export const deleteComment = b.deleteComment

export const putBlob = b.putBlob
export const getBlob = b.getBlob

export const importAll = b.importAll
export const clearAll = b.clearAll

export { cloudEnabled }
