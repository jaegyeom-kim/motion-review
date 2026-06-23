import { useState } from 'react'
import { sendLoginCode, verifyLoginCode } from '../lib/auth'

/** Email-OTP login. Step 1: enter email → a 6-digit code is mailed. Step 2:
 *  enter the code → session is created (the store's auth listener takes over).
 *  Signups are closed: unknown emails are rejected by the backend. */
export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const send = async () => {
    const e = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setError('올바른 이메일을 입력하세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await sendLoginCode(e)
      setStep('code')
      setInfo(`${e} 로 6자리 코드를 보냈어요. 메일함을 확인하세요.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // closed signup → friendly message
      setError(
        /not allowed|signups|user not found/i.test(msg)
          ? '등록되지 않은 이메일입니다. 관리자에게 초대를 요청하세요.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      await verifyLoginCode(email, code)
      // success → onAuthChange in the store swaps to the app.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>Motion Review</span>
        </div>
        <p className="login-sub muted">멀티 포맷 리뷰 · 협업 워크스페이스</p>

        {step === 'email' ? (
          <>
            <label className="field-label">이메일</label>
            <input
              className="input"
              type="email"
              autoFocus
              value={email}
              placeholder="you@company.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && send()}
            />
            <button className="btn primary login-btn" onClick={send} disabled={busy}>
              {busy ? '전송 중…' : '로그인 코드 받기'}
            </button>
          </>
        ) : (
          <>
            {info && <div className="login-info">{info}</div>}
            <label className="field-label">인증 코드 (6자리)</label>
            <input
              className="input login-code"
              inputMode="numeric"
              autoFocus
              value={code}
              placeholder="······"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && !busy && verify()}
            />
            <button className="btn primary login-btn" onClick={verify} disabled={busy}>
              {busy ? '확인 중…' : '로그인'}
            </button>
            <button
              className="btn ghost login-back"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
                setInfo('')
              }}
              disabled={busy}
            >
              이메일 다시 입력
            </button>
          </>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  )
}
