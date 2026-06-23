import { useState } from 'react'
import { Modal } from './Modal'
import { useStore } from '../store/useStore'
import type { Version } from '../types'

export function BranchDialog({
  fromVersion,
  onClose,
}: {
  fromVersion: Version
  onClose: () => void
}) {
  const branches = useStore((s) => s.branches)
  const createBranch = useStore((s) => s.createBranch)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return setErr('브랜치 이름을 입력하세요.')
    if (branches.some((b) => b.name === trimmed))
      return setErr('같은 이름의 브랜치가 이미 있습니다.')
    setBusy(true)
    try {
      await createBranch(trimmed, fromVersion.id)
      onClose()
    } catch (e) {
      setErr(String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="새 브랜치"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            브랜치 생성
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <b className="mono">v{fromVersion.globalNumber}</b> 를 복제해 별도 피드백을
        모으는 작업 라인을 만듭니다. 원본 main은 그대로 유지됩니다.
      </p>
      <div>
        <label className="field-label">브랜치 이름</label>
        <input
          className="input"
          autoFocus
          placeholder="예: fix-easing-pass"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setErr('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {err && (
        <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>
      )}
    </Modal>
  )
}
