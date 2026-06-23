import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useStore,
  selectBranchVersions,
  selectCurrentVersion,
} from '../store/useStore'
import type { Branch, Version } from '../types'
import { fmtRelative } from '../lib/labels'
import { exportAsset, exportVersionLottie } from '../lib/bundle'
import { IconBranch, IconCompare, IconCheck, IconPlus, IconDownload } from './Icon'
import { BranchDialog } from './BranchDialog'

export function VersionGraph({ onAddVersion }: { onAddVersion: () => void }) {
  const branches = useStore((s) => s.branches)
  const currentBranchId = useStore((s) => s.currentBranchId)
  const currentAssetId = useStore((s) => s.currentAssetId)
  const currentVersion = useStore(selectCurrentVersion)
  const assetName = useStore(
    (s) => s.assets.find((a) => a.id === s.currentAssetId)?.name ?? '',
  )
  const [branchFrom, setBranchFrom] = useState<Version | null>(null)

  // default branch first, then by creation
  const ordered = [...branches].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt,
  )

  return (
    <aside className="sidebar left">
      <div className="sidebar-head">
        <span>버전 그래프</span>
      </div>
      <div className="graph-scroll">
        {ordered.map((branch) => (
          <BranchBlock
            key={branch.id}
            branch={branch}
            isCurrent={branch.id === currentBranchId}
            onBranchFrom={setBranchFrom}
            assetName={assetName}
          />
        ))}
      </div>

      <div className="graph-foot">
        <button className="btn primary add-version" onClick={onAddVersion}>
          <IconPlus size={16} /> 새 버전 업로드
        </button>
        <div className="graph-foot-row">
          <button
            className="btn sm"
            disabled={!currentVersion}
            onClick={() => currentVersion && exportVersionLottie(currentVersion, assetName)}
            title="현재 버전의 Lottie(.json) 다운로드"
          >
            <IconDownload size={14} /> 현재 버전
          </button>
          <button
            className="btn sm"
            disabled={!currentAssetId}
            onClick={() => currentAssetId && exportAsset(currentAssetId)}
            title="전체 프로젝트를 번들(.json)로 내보내기"
          >
            <IconDownload size={14} /> 프로젝트
          </button>
        </div>
      </div>

      {branchFrom && (
        <BranchDialog fromVersion={branchFrom} onClose={() => setBranchFrom(null)} />
      )}
    </aside>
  )
}

function BranchBlock({
  branch,
  onBranchFrom,
  assetName,
}: {
  branch: Branch
  isCurrent: boolean
  onBranchFrom: (v: Version) => void
  assetName: string
}) {
  const versions = useStore(useShallow((s) => selectBranchVersions(s, branch.id)))
  const currentVersionId = useStore((s) => s.currentVersionId)
  const compareVersionId = useStore((s) => s.compareVersionId)
  const setCurrentVersion = useStore((s) => s.setCurrentVersion)
  const setCurrentBranch = useStore((s) => s.setCurrentBranch)
  const setCompare = useStore((s) => s.setCompare)

  const latestId = versions[versions.length - 1]?.id
  const newestFirst = [...versions].reverse()

  return (
    <div className="branch-block">
      <div
        className="branch-head"
        style={{ ['--bc' as string]: branch.color }}
        onClick={() => setCurrentBranch(branch.id)}
      >
        <span className="branch-dot" style={{ background: branch.color }} />
        <IconBranch size={14} />
        <span className="branch-name">{branch.name}</span>
        {branch.isDefault && <span className="branch-tag">기본</span>}
        <span className="branch-count">{versions.length}</span>
      </div>

      <div className="branch-lane" style={{ ['--bc' as string]: branch.color }}>
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
                  {v.approved && (
                    <IconCheck size={13} className="ver-approved" />
                  )}
                  <span className="ver-time muted">{fmtRelative(v.createdAt)}</span>
                </div>
                <div className="ver-msg" title={v.message}>
                  {v.message}
                </div>
                <div className="ver-meta muted mono">
                  {v.meta.totalFrames}f · {v.meta.frameRate}fps · {v.meta.layerCount}레이어
                </div>
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
                  title="이 버전에서 브랜치"
                  onClick={(e) => {
                    e.stopPropagation()
                    onBranchFrom(v)
                  }}
                >
                  <IconBranch size={14} />
                </button>
                <button
                  className="mini-btn"
                  title="이 버전 Lottie(.json) 다운로드"
                  onClick={(e) => {
                    e.stopPropagation()
                    exportVersionLottie(v, assetName)
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
  )
}
