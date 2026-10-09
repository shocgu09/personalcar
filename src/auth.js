// DT Club 회원 로그인 — AI 기능은 회원만 쓸 수 있다 (2026-10-09)
// dt 사이트와 같은 Firebase 프로젝트(dt-club)의 이메일 계정으로 로그인한다.
// 서버(/api/*)가 ID 토큰을 받아 dt 사이트에서 회원 여부와 하루 횟수를 확인한다.
import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'

const app = initializeApp({
  apiKey: 'AIzaSyDXJPgdgqDOUnjZam_kOHpaC4peCTJpvWI',
  authDomain: 'dt-club.firebaseapp.com',
  projectId: 'dt-club',
  appId: '1:1709148758:web:acc93145c8aebea4dd09f7',
})
export const auth = getAuth(app)

export const DT_URL = 'https://dt-1js.pages.dev/'

/** undefined: 확인 중 · null: 로그아웃 · User: 로그인 */
export function useAuthUser() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}

/** 서버 호출용 Authorization 헤더 */
export async function authHeader() {
  const u = auth.currentUser
  if (!u) throw new Error('DT Club 회원 로그인이 필요합니다.')
  return { Authorization: 'Bearer ' + (await u.getIdToken()) }
}

export function logout() { return signOut(auth) }
