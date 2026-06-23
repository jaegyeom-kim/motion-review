import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import type { Asset, AssetStatus, MediaKind } from '../types'
import { ASSET_STATUSES, MEDIA_KINDS } from '../types'
import { fmtRelative, ASSET_STATUS_META } from '../lib/labels'
import { KIND_LABEL, UPLOAD_KINDS_LABEL } from '../lib/media'
import {
  exportAsset,
  exportProjectZip,
  exportAssetsZip,
  exportAssetLatestFile,
  type ZipProgress,
} from '../lib/bundle'
import { UploadDialog } from '../components/UploadDialog'
import { Modal } from '../components/Modal'
import { ExportProgress } from '../components/ExportProgress'
import { AssetThumb, KindGlyph } from '../components/AssetThumb'
import { AuthControls } from '../components/AuthControls'
import {
  IconPlus,
  IconTrash,
  IconDownload,
  IconBack,
  IconGrid,
  IconList,
  IconMore,
  IconFolder,
  IconLayers,
  IconCheck,
  IconClose,
  IconChevron,
  IconUpload,
} from '../components/Icon'

type ViewMode = 'grid' | 'list'
type SortKey = 'modified' | 'name' | 'status'
type Filter =
  | { t: 'all' }
  | { t: 'media'; v: MediaKind }
  | { t: 'status'; v: AssetStatus }

const VIEW_KEY = 'lc-view'
const loadView = (): ViewMode =>
  (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid'

export function ProjectView() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const ready = useStore((s) => s.ready)
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const assets = useStore(
    useShallow((s) => s.assets.filter((a) => a.projectId === projectId)),
  )
  const deleteAsset = useStore((s) => s.deleteAsset)
  const createAsset = useStore((s) => s.createAsset)

  const [view, setView] = useState<ViewMode>(loadView)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<{ done: number; total: number; label: string } | null>(null)
  const dragDepth = useRef(0)
  const [sort, setSort] = useState<SortKey>('modified')
  const [filter, setFilter] = useState<Filter>({ t: 'all' })
  const [showUpload, setShowUpload] = useState(false)
  const [moving, setMoving] = useState<{ ids: string[]; label: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null)
  const [zipError, setZipError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // clear selection + reset category when switching projects
  useEffect(() => {
    setSelected(new Set())
    setFilter({ t: 'all' })
  }, [projectId])

  const setViewMode = (m: ViewMode) => {
    setView(m)
    localStorage.setItem(VIEW_KEY, m)
  }

  const kindCounts = useMemo(() => {
    const m = {} as Record<MediaKind, number>
    for (const a of assets) m[a.kind] = (m[a.kind] ?? 0) + 1
    return m
  }, [assets])
  const statusCounts = useMemo(() => {
    const m = {} as Record<AssetStatus, number>
    for (const a of assets) m[a.status] = (m[a.status] ?? 0) + 1
    return m
  }, [assets])
  const presentKinds = useMemo(
    () => MEDIA_KINDS.filter((k) => (kindCounts[k] ?? 0) > 0),
    [kindCounts],
  )

  const shown = useMemo(() => {
    let list = assets.filter((a) =>
      filter.t === 'all'
        ? true
        : filter.t === 'media'
          ? a.kind === filter.v
          : a.status === filter.v,
    )
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'status')
        return ASSET_STATUSES.indexOf(a.status) - ASSET_STATUSES.indexOf(b.status)
      return b.updatedAt - a.updatedAt
    })
    return list
  }, [assets, filter, sort])

  const filterLabel =
    filter.t === 'all'
      ? '전체 에셋'
      : filter.t === 'media'
        ? KIND_LABEL[filter.v]
        : ASSET_STATUS_META[filter.v].label

  const selecting = selected.size > 0
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const clearSel = () => setSelected(new Set())
  const allShownSelected = shown.length > 0 && shown.every((a) => selected.has(a.id))
  const toggleAll = () =>
    setSelected(allShownSelected ? new Set() : new Set(shown.map((a) => a.id)))

  if (!ready) return <div className="loading">불러오는 중…</div>
  if (!project)
    return (
      <div className="loading">
        프로젝트를 찾을 수 없습니다.{' '}
        <button className="btn sm" onClick={() => navigate('/')}>홈으로</button>
      </div>
    )

  const exportZip = async (run: () => Promise<void>, total: number) => {
    setExporting(true)
    setZipError(null)
    setZipProgress({ phase: 'collect', done: 0, total, label: '' })
    try {
      await run()
    } catch (e) {
      setZipError(e instanceof Error ? e.message : String(e))
    }
  }
  const runExportProject = () => exportZip(() => exportProjectZip(project.id, setZipProgress), assets.length)
  const runExportSelected = async () => {
    const ids = [...selected]
    // A single asset downloads as its own file directly (no zip/modal).
    if (ids.length === 1) {
      try {
        await exportAssetLatestFile(ids[0])
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      }
      return
    }
    exportZip(() => exportAssetsZip(ids, `${project.name}_선택${ids.length}`, setZipProgress), ids.length)
  }
  const closeExport = () => {
    setExporting(false)
    setZipProgress(null)
    setZipError(null)
  }

  // ---- drag-and-drop upload ----
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes('Files')

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    setUploading({ done: 0, total: files.length, label: '' })
    const errs: string[] = []
    for (let i = 0; i < files.length; i++) {
      setUploading({ done: i, total: files.length, label: files[i].name })
      try {
        await createAsset(files[i], files[i].name.replace(/\.[^.]+$/i, ''), '업로드', project.id)
      } catch (e) {
        errs.push(`${files[i].name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setUploading(null)
    if (errs.length) alert(`일부 파일 업로드 실패:\n\n${errs.join('\n')}`)
  }

  const onDragEnter = (e: React.DragEvent) => {
    if (!dragHasFiles(e) || uploading) return
    e.preventDefault()
    dragDepth.current++
    setDragOver(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (dragHasFiles(e) && !uploading) e.preventDefault()
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    if (!uploading) void uploadFiles(Array.from(e.dataTransfer.files))
  }

  const bulkDelete = () => {
    if (!confirm(`선택한 애셋 ${selected.size}개를 삭제할까요? 모든 버전·피드백이 사라집니다.`)) return
    selected.forEach((id) => deleteAsset(id))
    clearSel()
  }

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="drop-hint">
          <div className="drop-hint-inner">
            <IconUpload size={34} />
            <div className="drop-hint-text">여기에 놓아 업로드</div>
            <div className="muted">{UPLOAD_KINDS_LABEL}</div>
          </div>
        </div>
      )}
      {uploading && (
        <div className="scrim">
          <div className="modal export-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3><IconUpload size={17} /> 업로드 중</h3></div>
            <div className="modal-body export-body">
              <div className="export-status">
                <span className="spinner" /> {uploading.done}/{uploading.total} 처리 중
              </div>
              <div className="export-bar">
                <div
                  className="export-bar-fill"
                  style={{ width: `${uploading.total ? (uploading.done / uploading.total) * 100 : 0}%` }}
                />
              </div>
              <div className="export-label mono muted">{uploading.label}</div>
            </div>
          </div>
        </div>
      )}
      <div className="topbar">
        <button className="icon-btn" onClick={() => navigate('/')} title="프로젝트 목록">
          <IconBack />
        </button>
        <div className="breadcrumb">
          <button className="crumb" onClick={() => navigate('/')}>프로젝트</button>
          <span className="crumb-sep">/</span>
          <span className="crumb cur" style={{ ['--pc' as string]: project.color }}>
            <IconFolder size={14} /> {project.name}
          </span>
        </div>
        <div className="spacer" />
        <button
          className="btn"
          onClick={runExportProject}
          disabled={assets.length === 0 || exporting}
          title="프로젝트의 모든 파일을 ZIP으로 내보내기"
        >
          <IconDownload size={15} /> 내보내기
        </button>
        <button className="btn primary" onClick={() => setShowUpload(true)}>
          <IconPlus size={16} /> 새 애셋
        </button>
        <AuthControls />
      </div>

      <div className="proj-body">
        <ProjectRail
          filter={filter}
          setFilter={setFilter}
          totalCount={assets.length}
          presentKinds={presentKinds}
          kindCounts={kindCounts}
          statusCounts={statusCounts}
        />
        <div className="dash-scroll">
        <div className="dash-inner">
          <div className="proj-toolbar">
            {shown.length > 0 && (
              <label className="select-all" title="전체 선택">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} />
              </label>
            )}
            <h2 className="dash-h">
              {filterLabel} <span className="muted">{shown.length}</span>
            </h2>
            <div className="spacer" />
            <select
              className="filter-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="modified">최근 수정순</option>
              <option value="name">이름순</option>
              <option value="status">상태순</option>
            </select>
            <div className="seg view-seg">
              <button className={view === 'grid' ? 'on' : ''} onClick={() => setViewMode('grid')} title="그리드">
                <IconGrid size={15} />
              </button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setViewMode('list')} title="리스트">
                <IconList size={15} />
              </button>
            </div>
          </div>

          {assets.length === 0 ? (
            <div className="dash-empty">
              <p>이 프로젝트에 아직 애셋이 없습니다.</p>
              <button className="btn primary" onClick={() => setShowUpload(true)}>
                <IconPlus size={16} /> 첫 애셋 업로드
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="dash-empty"><p>필터에 맞는 애셋이 없습니다.</p></div>
          ) : view === 'grid' ? (
            <div className="asset-grid">
              {shown.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  selected={selected.has(a.id)}
                  selecting={selecting}
                  onToggle={() => toggleSelect(a.id)}
                  onOpen={() => navigate(`/asset/${a.id}`)}
                  onMove={() => setMoving({ ids: [a.id], label: a.name })}
                />
              ))}
            </div>
          ) : (
            <div className="asset-list">
              {shown.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  selected={selected.has(a.id)}
                  selecting={selecting}
                  onToggle={() => toggleSelect(a.id)}
                  onOpen={() => navigate(`/asset/${a.id}`)}
                  onMove={() => setMoving({ ids: [a.id], label: a.name })}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {selecting && (
        <SelectionBar
          count={selected.size}
          onDownload={runExportSelected}
          onMove={() => setMoving({ ids: [...selected], label: `${selected.size}개 애셋` })}
          onDelete={bulkDelete}
          onClear={clearSel}
        />
      )}

      {showUpload && (
        <UploadDialog
          mode="asset"
          projectId={project.id}
          onClose={() => setShowUpload(false)}
          onCreated={(id) => navigate(`/asset/${id}`)}
        />
      )}
      {moving && (
        <MoveDialog
          assetIds={moving.ids}
          label={moving.label}
          onClose={() => setMoving(null)}
          onDone={clearSel}
        />
      )}
      {exporting && (
        <ExportProgress progress={zipProgress} error={zipError} onClose={closeExport} />
      )}
    </div>
  )
}

function ProjectRail({
  filter,
  setFilter,
  totalCount,
  presentKinds,
  kindCounts,
  statusCounts,
}: {
  filter: Filter
  setFilter: (f: Filter) => void
  totalCount: number
  presentKinds: MediaKind[]
  kindCounts: Record<MediaKind, number>
  statusCounts: Record<AssetStatus, number>
}) {
  const Item = ({
    active,
    label,
    count,
    icon,
    onClick,
  }: {
    active: boolean
    label: string
    count?: number
    icon: React.ReactNode
    onClick: () => void
  }) => (
    <button className={`rail-item ${active ? 'on' : ''}`} onClick={onClick}>
      <span className="rail-ico">{icon}</span>
      <span className="rail-label">{label}</span>
      {count != null && <span className="rail-count">{count}</span>}
    </button>
  )
  const activeStatuses = ASSET_STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0)
  return (
    <aside className="proj-rail">
      <div className="rail-group">
        <Item
          active={filter.t === 'all'}
          label="전체 에셋"
          count={totalCount}
          icon={<IconLayers size={15} />}
          onClick={() => setFilter({ t: 'all' })}
        />
      </div>
      {presentKinds.length > 0 && (
        <div className="rail-group">
          <div className="rail-head">형식</div>
          {presentKinds.map((k) => (
            <Item
              key={k}
              active={filter.t === 'media' && filter.v === k}
              label={KIND_LABEL[k]}
              count={kindCounts[k]}
              icon={<KindGlyph kind={k} size={15} />}
              onClick={() => setFilter({ t: 'media', v: k })}
            />
          ))}
        </div>
      )}
      {activeStatuses.length > 0 && (
        <div className="rail-group">
          <div className="rail-head">리뷰 상태</div>
          {activeStatuses.map((s) => (
            <Item
              key={s}
              active={filter.t === 'status' && filter.v === s}
              label={ASSET_STATUS_META[s].label}
              count={statusCounts[s]}
              icon={
                <span
                  className="rail-dot"
                  style={{ background: ASSET_STATUS_META[s].color }}
                />
              }
              onClick={() => setFilter({ t: 'status', v: s })}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

function SelectionBar({
  count,
  onDownload,
  onMove,
  onDelete,
  onClear,
}: {
  count: number
  onDownload: () => void
  onMove: () => void
  onDelete: () => void
  onClear: () => void
}) {
  return (
    <div className="selection-bar">
      <button className="sel-clear" onClick={onClear} title="선택 해제">
        <IconClose size={15} />
      </button>
      <span className="sel-count">{count}개 선택됨</span>
      <span className="sel-divider" />
      <button className="btn sm primary" onClick={onDownload}>
        <IconDownload size={14} /> {count === 1 ? '파일 다운로드' : 'ZIP 다운로드'}
      </button>
      <button className="btn sm" onClick={onMove}>이동</button>
      <button className="btn sm danger" onClick={onDelete}>
        <IconTrash size={14} /> 삭제
      </button>
    </div>
  )
}

function SelectBox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      className={`select-box ${checked ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      title={checked ? '선택 해제' : '선택'}
    >
      {checked && <IconCheck size={15} />}
    </button>
  )
}

/** Inline asset status changer on a card/row — click the pill to pick a new
 *  review status without opening the asset (LottieFiles-style). */
function AssetStatusControl({ asset }: { asset: Asset }) {
  const setAssetStatus = useStore((s) => s.setAssetStatus)
  const [open, setOpen] = useState(false)
  const m = ASSET_STATUS_META[asset.status]
  return (
    <div className="status-control" onClick={(e) => e.stopPropagation()}>
      <button
        className="status-pill"
        style={{ color: m.color, background: `${m.color}1f`, borderColor: `${m.color}3a` }}
        onClick={() => setOpen((o) => !o)}
        title="상태 변경"
      >
        <span className="dot" style={{ background: m.color }} />
        {m.label}
        <IconChevron size={12} />
      </button>
      {open && (
        <div className="popover-menu status-menu" onMouseLeave={() => setOpen(false)}>
          {ASSET_STATUSES.map((s) => {
            const sm = ASSET_STATUS_META[s]
            return (
              <button
                key={s}
                className={s === asset.status ? 'on' : ''}
                onClick={() => {
                  setAssetStatus(asset.id, s)
                  setOpen(false)
                }}
              >
                <span className="dot" style={{ background: sm.color }} />
                {sm.label}
                {s === asset.status && <IconCheck size={13} className="status-cur" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AssetMenu({ asset, onMove }: { asset: Asset; onMove: () => void }) {
  const deleteAsset = useStore((s) => s.deleteAsset)
  const renameAsset = useStore((s) => s.renameAsset)
  const [open, setOpen] = useState(false)
  return (
    <div className="asset-menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button className="mini-btn" title="더보기" onClick={() => setOpen((o) => !o)}>
        <IconMore size={15} />
      </button>
      {open && (
        <div className="popover-menu" onMouseLeave={() => setOpen(false)}>
          <button
            onClick={() => {
              setOpen(false)
              const n = prompt('새 이름', asset.name)
              if (n) renameAsset(asset.id, n)
            }}
          >
            이름 변경
          </button>
          <button onClick={() => { setOpen(false); onMove() }}>다른 프로젝트로 이동</button>
          <button onClick={() => { setOpen(false); exportAsset(asset.id) }}>
            <IconDownload size={13} /> 번들 내보내기
          </button>
          <button
            className="danger"
            onClick={() => {
              setOpen(false)
              if (confirm(`'${asset.name}'을(를) 삭제할까요? 모든 버전·피드백이 사라집니다.`))
                deleteAsset(asset.id)
            }}
          >
            <IconTrash size={13} /> 삭제
          </button>
        </div>
      )}
    </div>
  )
}

function AssetCard({
  asset,
  selected,
  selecting,
  onToggle,
  onOpen,
  onMove,
}: {
  asset: Asset
  selected: boolean
  selecting: boolean
  onToggle: () => void
  onOpen: () => void
  onMove: () => void
}) {
  return (
    <div
      className={`asset-card ${selected ? 'selected' : ''} ${selecting ? 'selecting' : ''}`}
      onClick={() => (selecting ? onToggle() : onOpen())}
    >
      <div className="asset-thumb">
        <AssetThumb
          thumbnail={asset.thumbnail}
          kind={asset.kind}
          name={asset.name}
          assetId={asset.id}
          scrub
        />
      </div>
      {/* select + menu live OUTSIDE .asset-thumb so the hover-scrub layer can't
          cover them and the menu dropdown isn't clipped by the thumb's
          overflow:hidden. */}
      <div className="asset-card-select">
        <SelectBox checked={selected} onToggle={onToggle} />
      </div>
      <div className="asset-card-actions" onClick={(e) => e.stopPropagation()}>
        <AssetMenu asset={asset} onMove={onMove} />
      </div>
      <div className="asset-info">
        <div className="asset-name">{asset.name}</div>
        <div className="asset-foot">
          <AssetStatusControl asset={asset} />
          <span className="asset-time muted mono">{fmtRelative(asset.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function AssetRow({
  asset,
  selected,
  selecting,
  onToggle,
  onOpen,
  onMove,
}: {
  asset: Asset
  selected: boolean
  selecting: boolean
  onToggle: () => void
  onOpen: () => void
  onMove: () => void
}) {
  return (
    <div
      className={`asset-row ${selected ? 'selected' : ''} ${selecting ? 'selecting' : ''}`}
      onClick={() => (selecting ? onToggle() : onOpen())}
    >
      <div className="asset-row-select" onClick={(e) => e.stopPropagation()}>
        <SelectBox checked={selected} onToggle={onToggle} />
      </div>
      <div className="asset-row-thumb">
        <AssetThumb thumbnail={asset.thumbnail} kind={asset.kind} name={asset.name} />
      </div>
      <div className="asset-row-name">{asset.name}</div>
      <div className="asset-row-kind muted">{KIND_LABEL[asset.kind]}</div>
      <AssetStatusControl asset={asset} />
      <div className="asset-row-time muted mono">{fmtRelative(asset.updatedAt)}</div>
      <div onClick={(e) => e.stopPropagation()}>
        <AssetMenu asset={asset} onMove={onMove} />
      </div>
    </div>
  )
}

function MoveDialog({
  assetIds,
  label,
  onClose,
  onDone,
}: {
  assetIds: string[]
  label: string
  onClose: () => void
  onDone?: () => void
}) {
  const projects = useStore(useShallow((s) => s.projects))
  const moveAsset = useStore((s) => s.moveAsset)
  const [target, setTarget] = useState(projects[0]?.id ?? '')
  return (
    <Modal
      title="다른 프로젝트로 이동"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>취소</button>
          <button
            className="btn primary"
            disabled={!target}
            onClick={async () => {
              for (const id of assetIds) await moveAsset(id, target)
              onDone?.()
              onClose()
            }}
          >
            이동
          </button>
        </>
      }
    >
      <div>
        <label className="field-label">'{label}'을(를) 이동할 프로젝트</label>
        <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </Modal>
  )
}
