// DT Club 회원 로그인 — AI 기능은 회원만 쓸 수 있다 (2026-10-09)
// dt 사이트와 같은 Firebase 프로젝트(dt-club)의 이메일 계정으로 로그인한다.
// 서버(/api/*)가 ID 토큰을 받아 dt 사이트에서 회원 여부와 하루 횟수를 확인한다.
// dt 에서 카드를 눌러 넘어오면 주소 # 뒤에 2분짜리 로그인 토큰(dtsso)이 붙어 와 자동으로 로그인한다.
import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth'

const app = initializeApp({
  apiKey: 'AIzaSyDXJPgdgqDOUnjZam_kOHpaC4peCTJpvWI',
  authDomain: 'dt-club.firebaseapp.com',
  projectId: 'dt-club',
  appId: '1:1709148758:web:acc93145c8aebea4dd09f7',
})
export const auth = getAuth(app)

export const DT_URL = 'https://dt-1js.pages.dev/'

// dt 에서 넘어온 로그인 토큰 — 읽자마자 주소에서 지운다 (방문 기록·공유 링크에 남지 않게)
const ssoToken = (() => {
  const m = window.location.hash.match(/[#&]dtsso=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : null
})()
if (ssoToken) window.history.replaceState(null, '', window.location.pathname + window.location.search)
// 토큰이 만료됐거나 잘못됐으면 조용히 넘어가 로그인 화면을 보여 준다
const ssoDone = ssoToken ? signInWithCustomToken(auth, ssoToken).catch(() => {}) : Promise.resolve()

/** undefined: 확인 중 · null: 로그아웃 · User: 로그인 */
export function useAuthUser() {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    // 자동 로그인이 끝난 뒤에 상태를 본다 — 그 사이 로그인 화면이 깜빡이지 않게
    let alive = true
    let unsub = () => {}
    ssoDone.then(() => { if (alive) unsub = onAuthStateChanged(auth, setUser) })
    return () => { alive = false; unsub() }
  }, [])
  return user
}

/** 서버 호출용 Authorization 헤더 */
export async function authHeader() {
  const u = auth.currentUser
  if (!u) throw new Error('DT Club 회원 로그인이 필요해요.')
  return { Authorization: 'Bearer ' + (await u.getIdToken()) }
}

export function logout() { return signOut(auth) }
