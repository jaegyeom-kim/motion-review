import { useShallow } from 'zustand/react/shallow'
import { useStore, selectBranchVersions, selectCurrentVersion } from '../store/useStore'
import type { Version } from '../types'
import { fmtRelative, fmtDuration } from '../lib/labels'
import { exportVersion } from '../lib/bundle'
import { IconCompare, IconCheck, IconPlus, IconDownload } from './Icon'

/** Flat version history for non-Lottie assets (single implicit 'main' branch,
 *  no branching). The Lottie branch graph (VersionGraph) is unchanged. */
export function VersionRail({ onAddVersion }: { onAddVersion: () => void }) {
  const currentBranchId = useStore((s) => s.currentBranchId)
  const versions = useStore(
    useShallow((s) => (currentBranchId ? selectBranchVersions(s, currentBranchId) : [])),
  )
  const currentVersionId = useStore((s) => s.currentVersionId)
  const compareVersionId = useStore((s) => s.compareVersionId)
  const setCurrentVersion = useStore((s) => s.setCurrentVersion)
  const setCompare = useStore((s) => s.setCompare)
  const current = useStore(selectCurrentVersion)
  const assetName = useStore(
    (s) => s.assets.find((a) => a.id === s.currentAssetId)?.name ?? '',
  )

  const latestId = versions[versions.length - 1]?.id
  const newestFirst = [...versions].reverse()

  const metaLine = (v: Version) => {
    const m = v.meta
    switch (v.kind) {
      case 'image':
        return `${m.width}×${m.height}`
      case 'video':
        return `${m.width}×${m.height} · ${fmtDuration(m.durationSec)}`
      case 'audio':
        return fmtDuration(m.durationSec)
      default:
        return v.kind
    }
  }

  return (
    <aside className="sidebar left">
      <div className="sidebar-head">
        <span>버전 기록</span>
      </div>
      <div className="graph-scroll">
        <div className="branch-lane flat-lane">
          {newestFirst.map((v) => {
            const isCur = v.id === currentVersionId
            const isCmp = v.id === compareVersionId
            const dotColor = v.approved
              ? 'var(--green)'
              : v.id === latestId
                ? 'var(--amber)'
                : 'var(--text-3)'
            return (
              <div
                key={v.id}
                className={`ver-row ${isCur ? 'current' : ''} ${isCmp ? 'compare' : ''}`}
                onClick={() => setCurrentVersion(v.id)}
              >
                <span className="ver-node" style={{ background: dotColor }} />
                <div className="ver-main">
                  <div className="ver-top">
                    <span className="ver-num mono">v{v.globalNumber}</span>
                    {v.approved && <IconCheck size={13} className="ver-approved" />}
                    <span className="ver-time muted">{fmtRelative(v.createdAt)}</span>
                  </div>
                  <div className="ver-msg" title={v.message}>{v.message}</div>
                  <div className="ver-meta muted mono">{metaLine(v)}</div>
                </div>
                <div className="ver-actions">
                  <button
                    className={`mini-btn ${isCmp ? 'on' : ''}`}
                    title={isCmp ? '비교 해제' : '이 버전과 비교'}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCompare(isCmp ? null : v.id)
                    }}
                  >
                    <IconCompare size={14} />
                  </button>
                  <button
                    className="mini-btn"
                    title="이 버전 파일 다운로드"
                    onClick={(e) => {
                      e.stopPropagation()
                      exportVersion(v, assetName)
                    }}
                  >
                    <IconDownload size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="graph-foot">
        <button className="btn primary add-version" onClick={onAddVersion}>
          <IconPlus size={16} /> 새 버전 업로드
        </button>
        <div className="graph-foot-row">
          <button
            className="btn sm"
            disabled={!current}
            onClick={() => current && exportVersion(current, assetName)}
            title="현재 버전 파일 다운로드"
          >
            <IconDownload size={14} /> 현재 버전
          </button>
        </div>
      </div>
    </aside>
  )
}
