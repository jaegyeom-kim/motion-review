import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import type { Project } from '../types'
import { fmtRelative } from '../lib/labels'
import { importBundle } from '../lib/bundle'
import { Modal } from '../components/Modal'
import { KindGlyph } from '../components/AssetThumb'
import { AuthControls } from '../components/AuthControls'
import { IconPlus, IconTrash, IconUpload, IconFolder, IconMore } from '../components/Icon'

export function ProjectsHome() {
  const navigate = useNavigate()
  const ready = useStore((s) => s.ready)
  const projects = useStore(useShallow((s) => s.projects))
  const reloadAssets = useStore((s) => s.reloadAssets)
  const resetAll = useStore((s) => s.resetAll)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const sorted = [...projects].sort(
    (a, b) => a.order - b.order || b.updatedAt - a.updatedAt,
  )

  const onImport = async (file: File) => {
    try {
      const id = await importBundle(file)
      await reloadAssets()
      navigate(`/asset/${id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Motion Review
        </div>
        <span className="muted" style={{ fontSize: 12.5 }}>
          멀티 포맷 리뷰 · 버전 관리
        </span>
        <div className="spacer" />
        <button className="btn" onClick={() => importRef.current?.click()} title="번들(.json) 가져오기">
          <IconUpload size={15} /> 가져오기
        </button>
        <button className="btn" onClick={() => resetAll()} title="데모 데이터로 초기화">
          데모 초기화
        </button>
        <button className="btn primary" onClick={() => setShowNew(true)}>
          <IconPlus size={16} /> 새 프로젝트
        </button>
        <AuthControls />
        <input
          ref={importRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="dash-scroll">
        <div className="dash-inner">
          <h2 className="dash-h">
            프로젝트 {ready && <span className="muted">{projects.length}</span>}
          </h2>
          {ready && sorted.length === 0 ? (
            <div className="dash-empty">
              <IconFolder size={32} />
              <p>아직 프로젝트가 없습니다.</p>
              <button className="btn primary" onClick={() => setShowNew(true)}>
                <IconPlus size={16} /> 첫 프로젝트 만들기
              </button>
            </div>
          ) : (
            <div className="project-grid">
              {sorted.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => navigate(`/project/${p.id}`)}
                  onEdit={() => setEditing(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && <ProjectDialog onClose={() => setShowNew(false)} />}
      {editing && <ProjectDialog project={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ProjectCard({
  project,
  onOpen,
  onEdit,
}: {
  project: Project
  onOpen: () => void
  onEdit: () => void
}) {
  const assets = useStore(useShallow((s) => s.assets.filter((a) => a.projectId === project.id)))
  const deleteProject = useStore((s) => s.deleteProject)
  const kinds = [...new Set(assets.map((a) => a.kind))]
  const [menu, setMenu] = useState(false)

  return (
    <div className="project-card" onClick={onOpen} style={{ ['--pc' as string]: project.color }}>
      <div className="project-card-bar" />
      <div className="project-card-body">
        <div className="project-card-top">
          <span className="project-folder" style={{ color: project.color }}>
            <IconFolder size={20} />
          </span>
          <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
            <button className="mini-btn" title="더보기" onClick={() => setMenu((m) => !m)}>
              <IconMore size={15} />
            </button>
            {menu && (
              <div className="popover-menu" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => { setMenu(false); onEdit() }}>이름·설명 수정</button>
                <button
                  className="danger"
                  onClick={() => {
                    setMenu(false)
                    if (
                      confirm(
                        `'${project.name}' 프로젝트와 안의 애셋 ${assets.length}개를 모두 삭제할까요?`,
                      )
                    )
                      deleteProject(project.id)
                  }}
                >
                  <IconTrash size={13} /> 프로젝트 삭제
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="project-name">{project.name}</div>
        {project.description && (
          <div className="project-desc muted">{project.description}</div>
        )}
        <div className="project-card-foot">
          <span className="project-count">{assets.length}개 애셋</span>
          <span className="kind-glyphs">
            {kinds.map((k) => (
              <span key={k} className="kind-glyph-mini" title={k}>
                <KindGlyph kind={k} size={13} />
              </span>
            ))}
          </span>
          <span className="muted mono">{fmtRelative(project.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function ProjectDialog({
  project,
  onClose,
}: {
  project?: Project
  onClose: () => void
}) {
  const createProject = useStore((s) => s.createProject)
  const renameProject = useStore((s) => s.renameProject)
  const [name, setName] = useState(project?.name ?? '')
  const [desc, setDesc] = useState(project?.description ?? '')

  const save = async () => {
    if (!name.trim()) return
    if (project) await renameProject(project.id, name, desc)
    else await createProject(name, desc)
    onClose()
  }

  return (
    <Modal
      title={project ? '프로젝트 수정' : '새 프로젝트'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>
            {project ? '저장' : '만들기'}
          </button>
        </>
      }
    >
      <div>
        <label className="field-label">프로젝트 이름</label>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 봄 캠페인"
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && save()}
        />
      </div>
      <div>
        <label className="field-label">설명 (선택)</label>
        <input
          className="input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="프로젝트 한 줄 설명"
        />
      </div>
    </Modal>
  )
}
