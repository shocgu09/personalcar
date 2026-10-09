// 로그인 전·이메일 미인증일 때 보여 주는 화면
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, logout, DT_URL } from './auth.js'

const ERRORS = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.',
  'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
  'auth/too-many-requests': '로그인 시도가 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요.',
  'auth/user-disabled': '이용이 중지된 계정입니다.',
  'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
}

export default function LoginGate({ user, title }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return }
    setBusy(true); setError(null)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(ERRORS[err.code] || '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (user && !user.emailVerified) return (
    <div className="login-card">
      <h2 className="login-title">이메일 인증이 필요해요</h2>
      <p className="login-desc">{user.email} 로 보낸 인증 메일을 확인한 뒤 다시 로그인해 주세요.</p>
      <div className="login-actions">
        <a className="login-link" href={DT_URL} target="_blank" rel="noreferrer">DT Club 열기</a>
        <button type="button" className="reset-btn" onClick={logout}>로그아웃</button>
      </div>
    </div>
  )

  return (
    <form className="login-card" onSubmit={submit}>
      <h2 className="login-title">{title}</h2>
      <p className="login-desc">DT Club 회원 전용입니다. DT Club 계정으로 로그인해 주세요.</p>
      {error && <div className="error-box">⚠️ {error}</div>}
      <input className="login-input" type="email" autoComplete="email" placeholder="이메일"
        value={email} onChange={e => setEmail(e.target.value)} />
      <input className="login-input" type="password" autoComplete="current-password" placeholder="비밀번호"
        value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? '⏳ 로그인 중...' : '로그인'}</button>
      <p className="login-foot">
        계정이 없거나 비밀번호를 잊었다면 <a className="login-link" href={DT_URL} target="_blank" rel="noreferrer">DT Club</a>에서 가입·재설정할 수 있어요.
      </p>
    </form>
  )
}
