import { useRef, useState } from 'react'
import { fmtBytes, fmtDuration } from '../lib/labels'
import { ACCEPT_ALL, KIND_LABEL, type ParsedMedia } from '../lib/media'
import { IconUpload, IconCheck } from './Icon'

export function FileDrop({
  file,
  parsed,
  error,
  busy,
  onPick,
}: {
  file: File | null
  parsed: ParsedMedia | null
  error: string
  busy?: boolean
  onPick: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const metaLine = (() => {
    if (!parsed) return null
    const m = parsed.meta
    switch (parsed.kind) {
      case 'lottie':
        return `${m.width}×${m.height} · ${m.totalFrames}f · ${m.frameRate}fps · ${m.layerCount}레이어 · ${fmtBytes(m.fileSize)}`
      case 'image':
        return `${m.width}×${m.height} · ${fmtBytes(m.fileSize)}`
      case 'video':
        return `${m.width}×${m.height} · ${fmtDuration(m.durationSec)} · ${fmtBytes(m.fileSize)}`
      case 'audio':
        return `${fmtDuration(m.durationSec)} · ${fmtBytes(m.fileSize)}`
      case 'pdf':
        return fmtBytes(m.fileSize)
    }
  })()

  return (
    <div>
      <div
        className={`filedrop ${over ? 'over' : ''} ${file ? 'has' : ''} ${error ? 'err' : ''}`}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f && !busy) onPick(f)
        }}
      >
        {busy ? (
          <>
            <div className="spinner" />
            <div className="filedrop-name">파일 분석 중…</div>
          </>
        ) : file && !error ? (
          <>
            <IconCheck size={22} />
            <div className="filedrop-name">
              {parsed && <span className="kind-tag">{KIND_LABEL[parsed.kind]}</span>}
              {file.name}
            </div>
            {metaLine && <div className="filedrop-meta mono muted">{metaLine}</div>}
          </>
        ) : (
          <>
            <IconUpload size={22} />
            <div className="filedrop-name">
              파일을 드롭하거나 클릭해서 선택
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Lottie · 이미지 · 비디오 · PDF · 오디오
            </div>
          </>
        )}
      </div>
      {error && <div className="filedrop-error">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ALL}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
