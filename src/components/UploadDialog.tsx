import { useState } from 'react'
import { Modal } from './Modal'
import { FileDrop } from './FileDrop'
import { parseMedia, KIND_LABEL, type ParsedMedia } from '../lib/media'
import { useStore } from '../store/useStore'

export function UploadDialog({
  mode,
  projectId,
  branchId,
  onClose,
  onCreated,
}: {
  mode: 'asset' | 'version'
  /** required when mode==='asset' — the project the new asset lands in. */
  projectId?: string
  branchId?: string
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const createAsset = useStore((s) => s.createAsset)
  const addVersion = useStore((s) => s.addVersion)

  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedMedia | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)

  const pick = async (f: File) => {
    setError('')
    setFile(f)
    setParsed(null)
    setParsing(true)
    try {
      const p = await parseMedia(f)
      setParsed(p)
      if (mode === 'asset' && !name) setName(f.name.replace(/\.[^.]+$/i, ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setParsed(null)
    } finally {
      setParsing(false)
    }
  }

  const canSubmit =
    !!file && !!parsed && !error && !parsing && (mode === 'version' || name.trim())

  const submit = async () => {
    if (!file || !canSubmit) return
    setBusy(true)
    try {
      if (mode === 'asset' && projectId) {
        const id = await createAsset(file, name.trim(), message.trim(), projectId)
        onCreated?.(id)
      } else if (branchId) {
        await addVersion(file, message.trim(), branchId)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        mode === 'asset'
          ? '새 애셋 업로드'
          : `새 버전 업로드${parsed ? ` · ${KIND_LABEL[parsed.kind]}` : ''}`
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? '처리중…' : mode === 'asset' ? '생성' : '버전 추가'}
          </button>
        </>
      }
    >
      <FileDrop file={file} parsed={parsed} error={error} busy={parsing} onPick={pick} />
      {mode === 'asset' && (
        <div>
          <label className="field-label">이름</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="애셋 이름"
          />
        </div>
      )}
      <div>
        <label className="field-label">
          {mode === 'asset' ? '최초 메모' : '변경 메모 (커밋 메시지)'}
        </label>
        <input
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={mode === 'asset' ? '예: 최초 업로드' : '예: 색 보정, 컷 편집'}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
        />
      </div>
    </Modal>
  )
}
