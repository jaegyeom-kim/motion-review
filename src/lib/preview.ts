import * as db from './backend'
import type { MediaKind, LottieMeta } from '../types'

export interface AssetPreview {
  kind: MediaKind
  meta: LottieMeta
  /** parsed Lottie JSON (lottie kind). */
  data?: unknown
  /** raw media bytes (video/image/pdf/audio). */
  file?: Blob
}

const cache = new Map<string, AssetPreview | null>()

/** Load an asset's LATEST version payload for a hover-scrub preview. Cached
 *  per asset so repeated hovers don't re-hit IndexedDB. */
export async function loadAssetPreview(assetId: string): Promise<AssetPreview | null> {
  if (cache.has(assetId)) return cache.get(assetId)!
  const versions = await db.getVersions(assetId)
  if (!versions.length) {
    cache.set(assetId, null)
    return null
  }
  const latest = versions.reduce((a, b) => (b.globalNumber > a.globalNumber ? b : a))
  const blob = await db.getBlob(latest.id)
  const preview: AssetPreview = {
    kind: latest.kind,
    meta: latest.meta,
    data: blob?.data,
    file: blob?.file,
  }
  cache.set(assetId, preview)
  return preview
}

/** Whether an asset kind supports hover-scrub (has a temporal visual frame). */
export const isScrubbable = (kind: MediaKind) => kind === 'video' || kind === 'lottie'
