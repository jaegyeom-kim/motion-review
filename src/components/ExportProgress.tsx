import type { ZipProgress } from '../lib/bundle'
import { IconCheck, IconDownload } from './Icon'

/** Non-dismissable progress overlay shown while a project is zipped. */
export function ExportProgress({
  progress,
  error,
  onClose,
}: {
  progress: ZipProgress | null
  error: string | null
  onClose: () => void
}) {
  const done = progress?.phase === 'done'
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0
  const finished = done || !!error

  return (
    <div className="scrim">
      <div className="modal export-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            <IconDownload size={17} /> 프로젝트 내보내기
          </h3>
        </div>
        <div className="modal-body export-body">
          {error ? (
            <div className="export-error">{error}</div>
          ) : done ? (
            <div className="export-done">
              <span className="export-check">
                <IconCheck size={18} />
              </span>
              ZIP 다운로드가 시작되었습니다.
            </div>
          ) : (
            <>
              <div className="export-status">
                {progress?.phase === 'compress' ? (
                  <>
                    <span className="spinner" /> 압축하는 중…
                  </>
                ) : (
                  <>
                    파일 수집 중 · {progress?.done ?? 0}/{progress?.total ?? 0}
                  </>
                )}
              </div>
              <div className="export-bar">
                <div
                  className={`export-bar-fill ${progress?.phase === 'compress' ? 'indet' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="export-label mono muted">{progress?.label ?? ''}</div>
            </>
          )}
        </div>
        {finished && (
          <div className="modal-foot">
            <button className="btn primary" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
