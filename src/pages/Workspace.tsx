import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  useStore,
  selectCurrentVersion,
  selectCurrentBranch,
  selectVersionComments,
} from '../store/useStore'
import { usePlayback } from '../hooks/usePlayback'
import { isOpenComment, ASSET_STATUS_META } from '../lib/labels'
import { ASSET_STATUSES, isTemporalKind, isVisualKind, type MediaKind } from '../types'
import { VersionGraph } from '../components/VersionGraph'
import { VersionRail } from '../components/VersionRail'
import { LottieStage } from '../components/LottieStage'
import { MediaPinStage } from '../components/MediaPinStage'
import { VideoCanvas } from '../components/VideoCanvas'
import { PdfStage } from '../components/PdfStage'
import { AudioStage } from '../components/AudioStage'
import { PlayerControls } from '../components/PlayerControls'
import { CommentPanel } from '../components/CommentPanel'
import { CompareView } from '../components/CompareView'
import { MediaCompare } from '../components/MediaCompare'
import { VersionSelector } from '../components/VersionSelector'
import { IdentityChip } from '../components/IdentityChip'
import { UploadDialog } from '../components/UploadDialog'
import { VerdictChip } from '../components/Badges'
import { IconBack, IconBranch, IconCheck, IconCompare } from '../components/Icon'

const COMPARABLE: MediaKind[] = ['lottie', 'image', 'video']

export function Workspace() {
  const { assetId } = useParams()
  const navigate = useNavigate()

  const ready = useStore((s) => s.ready)
  const assets = useStore((s) => s.assets)
  const currentAssetId = useStore((s) => s.currentAssetId)
  const openAsset = useStore((s) => s.openAsset)
  const closeAsset = useStore((s) => s.closeAsset)

  const branch = useStore(selectCurrentBranch)
  const version = useStore(selectCurrentVersion)
  const compareVersionId = useStore((s) => s.compareVersionId)
  const compareVersion = useStore((s) =>
    s.versions.find((v) => v.id === s.compareVersionId),
  )
  const comments = useStore(
    useShallow((s) => (version ? selectVersionComments(s, version.id) : [])),
  )
  const ensureAnim = useStore((s) => s.ensureAnim)
  const ensureMediaFile = useStore((s) => s.ensureMediaFile)
  const approveVersion = useStore((s) => s.approveVersion)
  const setAssetStatus = useStore((s) => s.setAssetStatus)
  const setPlacingPin = useStore((s) => s.setPlacingPin)
  const setDraftPin = useStore((s) => s.setDraftPin)
  const placingPin = useStore((s) => s.placingPin)
  const draftPin = useStore((s) => s.draftPin)
  const selectedCommentId = useStore((s) => s.selectedCommentId)
  const selectComment = useStore((s) => s.selectComment)
  const movePin = useStore((s) => s.movePin)
  const setCompare = useStore((s) => s.setCompare)
  const allVersions = useStore(useShallow((s) => s.versions))

  const asset = assets.find((a) => a.id === assetId)
  const kind = asset?.kind ?? 'lottie'
  const isLottie = kind === 'lottie'
  const temporal = isTemporalKind(kind)
  const visual = isVisualKind(kind)

  // animA/animB hold parsed Lottie JSON; fileA/fileB hold raw media Blobs.
  const [animA, setAnimA] = useState<unknown>(null)
  const [animB, setAnimB] = useState<unknown>(null)
  const [fileA, setFileA] = useState<Blob | null>(null)
  const [fileB, setFileB] = useState<Blob | null>(null)
  const [imgUrl, setImgUrl] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  // open asset when route changes
  useEffect(() => {
    if (ready && assetId && currentAssetId !== assetId) {
      if (assets.some((a) => a.id === assetId)) openAsset(assetId)
    }
  }, [ready, assetId, currentAssetId, assets, openAsset])

  useEffect(() => () => closeAsset(), [closeAsset])

  // load current version payload (lottie JSON or raw media file)
  useEffect(() => {
    let alive = true
    setAnimA(null)
    setFileA(null)
    if (version) {
      if (version.kind === 'lottie')
        ensureAnim(version.id).then((d) => alive && setAnimA(d))
      else ensureMediaFile(version.id).then((f) => alive && setFileA(f))
    }
    return () => {
      alive = false
    }
  }, [version?.id, version?.kind, ensureAnim, ensureMediaFile])

  // load compare version payload
  useEffect(() => {
    let alive = true
    setAnimB(null)
    setFileB(null)
    if (compareVersion) {
      if (compareVersion.kind === 'lottie')
        ensureAnim(compareVersion.id).then((d) => alive && setAnimB(d))
      else ensureMediaFile(compareVersion.id).then((f) => alive && setFileB(f))
    }
    return () => {
      alive = false
    }
  }, [compareVersion?.id, compareVersion?.kind, ensureAnim, ensureMediaFile])

  // object URL for image kind (video manages its own inside VideoCanvas)
  useEffect(() => {
    if (kind === 'image' && fileA) {
      const u = URL.createObjectURL(fileA)
      setImgUrl(u)
      return () => URL.revokeObjectURL(u)
    }
    setImgUrl('')
  }, [kind, fileA])

  const meta = version?.meta
  // Temporal clock runs on the LONGER of the two clips (compare) so both play
  // fully. Non-temporal kinds get totalFrames 0 → the clock idles.
  const clockMeta =
    temporal && compareVersion && meta && compareVersion.meta.durationSec > meta.durationSec
      ? compareVersion.meta
      : meta
  const pb = usePlayback(temporal ? clockMeta?.totalFrames ?? 0 : 0, clockMeta?.frameRate ?? 30)

  // keyboard shortcuts (temporal kinds only)
  useEffect(() => {
    if (!temporal) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))
        return
      if (e.code === 'Space') {
        e.preventDefault()
        pb.toggle()
      } else if (e.key === 'ArrowLeft') {
        pb.step(e.shiftKey ? -10 : -1)
      } else if (e.key === 'ArrowRight') {
        pb.step(e.shiftKey ? 10 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [temporal, pb.toggle, pb.step])

  useEffect(() => {
    if (placingPin) pb.pause()
  }, [placingPin, pb.pause])

  useEffect(() => {
    if (compareVersionId) setPlacingPin(false)
  }, [compareVersionId, setPlacingPin])

  const openCount = useMemo(
    () => comments.filter((c) => isOpenComment(c.status)).length,
    [comments],
  )

  if (!ready) return <div className="loading">불러오는 중…</div>
  if (!asset)
    return (
      <div className="loading">
        애셋을 찾을 수 없습니다.{' '}
        <button className="btn sm" onClick={() => navigate('/')}>
          홈으로
        </button>
      </div>
    )

  const canCompareKind = COMPARABLE.includes(kind)
  const comparing =
    canCompareKind && !!compareVersion && compareVersion.id !== version?.id
  const dataReadyA = isLottie ? !!animA : !!fileA
  const dataReadyB = isLottie ? !!animB : !!fileB
  const inCompare = comparing && dataReadyA && dataReadyB

  // shared scrubber end marker for temporal compare (shorter clip end)
  const endMarker = (() => {
    if (!inCompare || !temporal || !compareVersion || !version) return null
    const baseDur = version.meta.durationSec
    const otherDur = compareVersion.meta.durationSec
    if (baseDur.toFixed(2) === otherDur.toFixed(2)) return null
    const baseShorter = baseDur < otherDur
    const shortDur = Math.min(baseDur, otherDur)
    const longDur = Math.max(baseDur, otherDur)
    return {
      pct: (shortDur / longDur) * 100,
      label: `v${(baseShorter ? version : compareVersion).globalNumber} 종료`,
      color: baseShorter ? 'var(--accent)' : 'var(--teal)',
    }
  })()

  const startComment = (x = 0.5, y = 0.5) => {
    pb.pause()
    setDraftPin({ frame: Math.round(pb.frame), x, y })
    setPlacingPin(true)
  }

  const toggleCompare = () => {
    if (compareVersionId) {
      setCompare(null)
      return
    }
    if (!version) return
    const others = allVersions.filter(
      (v) => v.id !== version.id && v.assetId === version.assetId,
    )
    if (!others.length) return
    const sameBranch = others
      .filter((v) => v.branchId === version.branchId)
      .sort((a, b) => b.number - a.number)
    const target = sameBranch[0] ?? [...others].sort((a, b) => b.createdAt - a.createdAt)[0]
    setCompare(target.id)
  }

  const toggleApprove = () => {
    if (!version) return
    if (!version.approved && openCount > 0) {
      const ok = window.confirm(
        `미해결 피드백 ${openCount}건이 남아 있습니다. 그래도 이 버전을 승인할까요?`,
      )
      if (!ok) return
    }
    approveVersion(version.id, !version.approved)
  }

  // shared pin-stage handlers (image/video)
  const stageHandlers = {
    selectedId: selectedCommentId,
    currentFrame: pb.frame,
    placing: placingPin,
    draft: draftPin,
    onSelect: (id: string) => selectComment(id),
    onPlaceDraft: (x: number, y: number) =>
      setDraftPin({ frame: Math.round(pb.frame), x, y }),
    onQuickComment: (x: number, y: number) => startComment(x, y),
    onMovePin: (id: string, x: number, y: number) => movePin(id, x, y),
    onSeekToFrame: (f: number) => {
      pb.pause()
      pb.seek(f)
    },
    onCancelPlacing: () => setPlacingPin(false),
  }

  const renderStage = () => {
    if (isLottie)
      return (
        <LottieStage
          data={animA}
          frame={pb.frame}
          meta={meta!}
          pins={comments}
          selectedId={selectedCommentId}
          currentFrame={pb.frame}
          placing={placingPin}
          draft={draftPin}
          onSelect={(id) => selectComment(id)}
          onPlaceDraft={(x, y) => setDraftPin({ frame: Math.round(pb.frame), x, y })}
          onQuickComment={(x, y) => startComment(x, y)}
          onMovePin={(id, x, y) => movePin(id, x, y)}
          onSeekToFrame={(f) => {
            pb.pause()
            pb.seek(f)
          }}
          onCancelPlacing={() => setPlacingPin(false)}
        />
      )
    if (kind === 'image')
      return imgUrl ? (
        <MediaPinStage
          media={<img className="media-image" src={imgUrl} alt={asset.name} draggable={false} />}
          aspect={(meta!.width || 1) / (meta!.height || 1)}
          temporal={false}
          fps={meta!.frameRate || 30}
          pins={comments}
          hint="이미지에서 위치를 클릭하세요"
          {...stageHandlers}
        />
      ) : (
        <div className="loading">이미지 불러오는 중…</div>
      )
    if (kind === 'video')
      return fileA ? (
        <MediaPinStage
          media={
            <VideoCanvas
              file={fileA}
              frame={pb.frame}
              fps={meta!.frameRate || 30}
              playing={pb.playing}
              speed={pb.speed}
            />
          }
          aspect={(meta!.width || 16) / (meta!.height || 9)}
          temporal
          fps={meta!.frameRate || 30}
          pins={comments}
          hint={`위치를 클릭하세요 · 현재 프레임 ${Math.round(pb.frame)}`}
          {...stageHandlers}
        />
      ) : (
        <div className="loading">비디오 불러오는 중…</div>
      )
    if (kind === 'pdf')
      return fileA ? <PdfStage file={fileA} /> : <div className="loading">PDF 불러오는 중…</div>
    if (kind === 'audio')
      return fileA ? (
        <AudioStage
          file={fileA}
          pb={pb}
          pins={comments}
          selectedId={selectedCommentId}
          placing={placingPin}
          onPlaceDraft={(frame) => setDraftPin({ frame, x: 0.5, y: 0.5 })}
          onSelect={(id) => selectComment(id)}
        />
      ) : (
        <div className="loading">오디오 불러오는 중…</div>
      )
    return <div className="loading">미리보기를 지원하지 않는 형식입니다.</div>
  }

  const statusColor = ASSET_STATUS_META[asset.status].color
  // Comment panel shows for visual kinds + audio; PDF has no comments yet.
  const showPanel = !comparing && version && (visual || kind === 'audio')

  return (
    <div className="app">
      <div className="topbar ws-topbar">
        <button className="icon-btn" onClick={() => navigate(`/project/${asset.projectId}`)} title="프로젝트로">
          <IconBack />
        </button>
        <div className="ws-title">
          <span className="ws-asset-name">{asset.name}</span>
          {isLottie && branch && (
            <span className="branch-chip" style={{ ['--bc' as string]: branch.color }}>
              <IconBranch size={13} />
              {branch.name}
            </span>
          )}
        </div>

        <div className="spacer" />
        <VersionSelector />
        {canCompareKind && (
          <div className="view-tabs" role="tablist" aria-label="보기 모드">
            <button
              className={!compareVersionId ? 'on' : ''}
              onClick={() => compareVersionId && setCompare(null)}
            >
              단일 보기
            </button>
            <button
              className={compareVersionId ? 'on' : ''}
              onClick={() => !compareVersionId && toggleCompare()}
              disabled={
                allVersions.filter((v) => v.assetId === asset.id).length < 2
              }
              title="두 버전을 나란히/겹쳐서 비교"
            >
              <IconCompare size={15} /> 버전 비교
            </button>
          </div>
        )}
        <div className="spacer" />

        <IdentityChip />
        <select
          className="asset-status-select"
          value={asset.status}
          style={{ color: statusColor, borderColor: `${statusColor}66` }}
          onChange={(e) => setAssetStatus(asset.id, e.target.value as never)}
          title="애셋 리뷰 상태"
        >
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ASSET_STATUS_META[s].label}
            </option>
          ))}
        </select>
        {version && <VerdictChip approved={version.approved} />}
        <button
          className={`btn sm ${version?.approved ? '' : 'primary'}`}
          onClick={toggleApprove}
        >
          <IconCheck size={14} /> {version?.approved ? '승인 취소' : '승인'}
        </button>
      </div>

      <div className="ws-body">
        {isLottie ? (
          <VersionGraph onAddVersion={() => setShowUpload(true)} />
        ) : (
          <VersionRail onAddVersion={() => setShowUpload(true)} />
        )}

        <main className="ws-center">
          {!version || !meta ? (
            <div className="loading">버전 없음</div>
          ) : comparing && compareVersion ? (
            inCompare ? (
              isLottie ? (
                <CompareView
                  base={version}
                  baseData={animA}
                  other={compareVersion}
                  otherData={animB}
                  pb={pb}
                />
              ) : (
                <MediaCompare
                  kind={kind}
                  base={version}
                  baseFile={fileA!}
                  other={compareVersion}
                  otherFile={fileB!}
                  pb={pb}
                />
              )
            ) : (
              <div className="loading">비교 불러오는 중…</div>
            )
          ) : (
            renderStage()
          )}

          {version && meta && temporal && (
            <PlayerControls
              pb={pb}
              pins={comparing ? [] : comments}
              selectedId={selectedCommentId}
              onSelectPin={(id) => selectComment(id)}
              onCommentHere={() => startComment()}
              placing={placingPin}
              canComment={!comparing}
              endMarker={endMarker}
            />
          )}
        </main>

        {showPanel && version && <CommentPanel version={version} pb={pb} />}
      </div>

      {showUpload && branch && (
        <UploadDialog
          mode="version"
          branchId={branch.id}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
