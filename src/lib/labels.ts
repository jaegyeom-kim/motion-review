import type { AssetStatus, CommentStatus, CommentTag } from '../types'

export const ASSET_STATUS_META: Record<
  AssetStatus,
  { label: string; color: string }
> = {
  draft: { label: '초안', color: '#868a96' },
  in_review: { label: '검토중', color: '#5b9bff' },
  needs_changes: { label: '수정필요', color: '#ff7a59' },
  approved: { label: '승인됨', color: '#58c98a' },
}

export const TAG_META: Record<CommentTag, { label: string; color: string }> = {
  fix: { label: '수정', color: '#ff5c6c' },
  timing: { label: '타이밍', color: '#5b9bff' },
  color: { label: '색상', color: '#ff6b9d' },
  shape: { label: '셰이프', color: '#9bd35a' },
  easing: { label: '이징', color: '#ffc24b' },
  question: { label: '질문', color: '#3ad1c4' },
  idea: { label: '아이디어', color: '#7c6cff' },
}

export const STATUS_META: Record<
  CommentStatus,
  { label: string; color: string }
> = {
  open: { label: '열림', color: '#ff7a59' },
  in_progress: { label: '진행중', color: '#ffc24b' },
  resolved: { label: '해결됨', color: '#58c98a' },
  wont_fix: { label: '보류', color: '#868a96' },
}

/** A comment counts as "actionable" (blocks approval) when it isn't closed. */
export function isOpenComment(status: CommentStatus) {
  return status === 'open' || status === 'in_progress'
}

export function fmtTimecode(frame: number, fps: number) {
  const totalSec = frame / (fps || 30)
  const s = Math.floor(totalSec)
  const f = Math.round((totalSec - s) * (fps || 30))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(f).padStart(2, '0')}`
}

/** Seconds → m:ss (or h:mm:ss) for video/audio readouts. */
export function fmtDuration(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '0:00'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(ss).padStart(2, '0')}`
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function fmtRelative(ts: number) {
  const diff = Math.max(0, Date.now() - ts)
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}일 전`
  return new Date(ts).toLocaleDateString('ko-KR')
}
