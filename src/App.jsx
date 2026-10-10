import { useState, useRef, useCallback } from 'react'
import html2canvas from 'html2canvas'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import './App.css'
import { useAuthUser, authHeader, logout } from './auth.js'
import LoginGate from './LoginGate.jsx'

/* 이미지 압축 (800px, JPEG 85%) */
function compressImage(dataUrl, maxPx = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요. 다시 시도해 주세요.'))
    img.src = dataUrl
  })
}

const LOADING_STEPS = [
  { icon: '🔍', text: '얼굴형 & 이미지 분석 중...' },
  { icon: '🎨', text: '스타일 & 분위기 파악 중...' },
  { icon: '🚗', text: '맞춤 차량 매칭 중...' },
  { icon: '🖼️', text: '차량 이미지 생성 중...' },
]

export default function App() {
  const user = useAuthUser()
  const [step, setStep] = useState('upload')   // upload | loading | result
  const [image, setImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const fileInputRef = useRef(null)
  const resultRef = useRef(null)
  const cropImgRef = useRef(null)
  const cropperRef = useRef(null)
  const [shareMsg, setShareMsg] = useState('')
  const [sharing, setSharing] = useState(false)
  const [rawImage, setRawImage] = useState(null)
  const [showCrop, setShowCrop] = useState(false)
  const [showConsent, setShowConsent] = useState(false)

  /* img 로드 완료 후 Cropper.js 초기화 */
  const initCropper = () => {
    if (cropperRef.current) { cropperRef.current.destroy(); cropperRef.current = null }
    cropperRef.current = new Cropper(cropImgRef.current, {
      aspectRatio: 3 / 4,
      viewMode: 1,
      dragMode: 'move',
      cropBoxMovable: false,
      cropBoxResizable: false,
      autoCropArea: 1,
      zoomable: true,
      toggleDragModeOnDblclick: false,
    })
  }

  /* 파일 처리 → crop 화면 열기 */
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => { setRawImage(e.target.result); setShowCrop(true) }
    reader.readAsDataURL(file)
  }

  /* crop 확정 */
  const applyCrop = () => {
    if (!cropperRef.current) return
    setImage(cropperRef.current.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 }).toDataURL('image/jpeg', 0.9))
    setShowCrop(false)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  /* 동의 후 분석 실행 */
  const handleConsentConfirm = () => {
    setShowConsent(false)
    handleAnalyze()
  }

  /* 분석 요청 */
  const handleAnalyze = async () => {
    if (!image) return
    setStep('loading'); setError(null); setLoadingStep(0)

    // 로딩 단계 애니메이션
    const timer = setInterval(() => {
      setLoadingStep(p => (p < LOADING_STEPS.length - 1 ? p + 1 : p))
    }, 2500)

    try {
      const compressed = await compressImage(image)
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ image: compressed }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '분석하지 못했어요.')
      setResult(data)
      setStep('result')
    } catch (err) {
      setError(err.message)
      setStep('upload')
    } finally {
      clearInterval(timer)
    }
  }

  const reset = () => { setStep('upload'); setImage(null); setResult(null); setError(null) }

  const handleShare = async () => {
    if (!resultRef.current || sharing) return
    setSharing(true)
    try {
      const canvas = await html2canvas(resultRef.current, {
        backgroundColor: '#151b24',
        scale: 2,
        useCORS: true,
        onclone: async (clonedDoc) => {
          const imgs = clonedDoc.querySelectorAll('.result-photo')
          for (const img of imgs) {
            const w = img.offsetWidth || 300
            const h = img.offsetHeight || 240
            const c = document.createElement('canvas')
            c.width = w; c.height = h
            const ctx = c.getContext('2d')
            const image = new Image()
            image.crossOrigin = 'anonymous'
            await new Promise(resolve => { image.onload = resolve; image.src = img.src })
            // object-fit: cover 직접 계산
            const scale = Math.max(w / image.width, h / image.height)
            const sw = w / scale, sh = h / scale
            const sx = (image.width - sw) / 2, sy = (image.height - sh) / 2
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h)
            c.style.cssText = img.style.cssText
            img.replaceWith(c)
          }
        },
      })
      canvas.toBlob(async (blob) => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        const file = new File([blob], 'carfit-result.png', { type: 'image/png' })
        if (isMobile && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'carfit-result.png'; a.click()
          URL.revokeObjectURL(url)
          setShareMsg('이미지를 저장했어요!')
          setTimeout(() => setShareMsg(''), 2500)
        }
      }, 'image/png')
    } catch (e) {
      setShareMsg('공유 중 오류가 생겼어요.')
      setTimeout(() => setShareMsg(''), 2500)
    } finally {
      setSharing(false)
    }
  }

  /* ── 개인정보 동의 모달 ── */
  const consentModal = showConsent && (
    <div className="consent-overlay" onClick={() => setShowConsent(false)}>
      <div className="consent-modal" onClick={e => e.stopPropagation()}>
        <h2 className="consent-title">🔒 개인정보 수집 및 이용 동의</h2>
        <ul className="consent-list">
          <li>업로드한 사진은 AI 분석을 위해 <strong>OpenAI 서버</strong>로 전송돼요.</li>
          <li>전송된 이미지는 분석 완료 후 <strong>당사 서버에 저장되지 않아요.</strong></li>
          <li>OpenAI의 데이터 처리 방침은 <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noreferrer">OpenAI 개인정보처리방침</a>을 참고하세요.</li>
          <li>얼굴 사진 등 민감한 개인정보를 포함할 수 있으므로 신중히 동의해 주세요.</li>
        </ul>
        <div className="consent-actions">
          <button className="btn-outline-crop" onClick={() => setShowConsent(false)}>닫기</button>
          <button className="btn-primary-crop" onClick={handleConsentConfirm}>동의하고 분석 시작</button>
        </div>
      </div>
    </div>
  )

  /* ── CROP 화면 ── */
  if (showCrop) return (
    <div className="app">
      <header className="header">
        <div className="logo">🚗 CarFit</div>
      </header>
      <section className="crop-section">
        <h2 className="crop-title">사진 영역 선택</h2>
        <p className="crop-desc">사진을 드래그·핀치해서 원하는 위치로 맞춰 주세요</p>
        <div className="crop-wrap">
          <img ref={cropImgRef} src={rawImage} alt="crop" onLoad={initCropper} style={{ maxWidth: '100%', display: 'block' }} />
        </div>
        <div className="crop-actions">
          <button className="btn-outline-crop" onClick={() => setShowCrop(false)}>취소</button>
          <button className="btn-primary-crop" onClick={applyCrop}>✂️ 선택 완료</button>
        </div>
      </section>
    </div>
  )

  /* ── UPLOAD ── */
  if (step === 'upload') return (
    <div className="app">
      {consentModal}
      <header className="header">
        <div className="logo">🚗 CarFit</div>
        <p className="logo-sub">AI 퍼스널 차 추천</p>
        {user && <button type="button" className="logout-btn" onClick={logout}>로그아웃</button>}
      </header>

      <section className="hero">
        <div className="badge">✨ AI 기반 분석</div>
        <h1>나에게 <span className="accent">딱 맞는 차</span>를<br />찾아 드려요</h1>
        <p className="hero-desc">
          본인 사진 한 장으로 얼굴형, 스타일, 분위기를 분석해<br />
          퍼스널 맞춤 차량을 추천해 드려요.
        </p>
      </section>

      {user === undefined ? null : !user || !user.emailVerified ? (
        <LoginGate user={user} title="로그인하고 차 추천받기" />
      ) : (
      <section className="upload-section">
        {error && <div className="error-box">⚠️ {error}</div>}

        <div
          className={`upload-box${isDragging ? ' dragging' : ''}${image ? ' has-image' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => !image && fileInputRef.current.click()}
        >
          {image ? (
            <div className="preview-wrap">
              <img src={image} alt="업로드된 사진" className="preview-img" />
              <button className="remove-btn" onClick={(e) => { e.stopPropagation(); setImage(null) }}>✕</button>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">📷</div>
              <p className="upload-title">사진을 드래그하거나 클릭해서 업로드</p>
              <p className="upload-hint">JPG, PNG, WEBP · 최대 10MB</p>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])} />

        <div className="btn-group">
          {image && (
            <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>
              📁 다시 선택
            </button>
          )}
          <button className={`btn-primary${!image ? ' disabled' : ''}`}
            disabled={!image} onClick={() => image && setShowConsent(true)}>
            {image ? '🔍 차량 추천받기' : '사진을 먼저 업로드해 주세요'}
          </button>
        </div>

        {!image && (
          <div className="tips">
            <div className="tip">💡 정면 사진일수록 정확도가 높아요</div>
            <div className="tip">🔒 사진은 분석 후 바로 삭제돼요</div>
          </div>
        )}
      </section>
      )}
    </div>
  )

  /* ── LOADING ── */
  if (step === 'loading') return (
    <div className="app loading-app">
      <div className="loading-wrap">
        <div className="loading-spinner" />
        <h2 className="loading-title">분석하고 있어요</h2>
        <div className="loading-steps">
          {LOADING_STEPS.map((s, i) => (
            <div key={i} className={`loading-step${i <= loadingStep ? ' active' : ''}${i < loadingStep ? ' done' : ''}`}>
              <span className="step-icon">{i < loadingStep ? '✅' : s.icon}</span>
              <span className="step-text">{s.text}</span>
            </div>
          ))}
        </div>
        <p className="loading-hint">20~30초쯤 걸려요</p>
      </div>
    </div>
  )

  /* ── RESULT ── */
  return (
    <div className="app">
      <header className="header">
        <div className="logo">🚗 CarFit</div>
        <button className="reset-btn" onClick={reset}>← 다시 분석</button>
      </header>

      <div ref={resultRef} className="result-capture">
      {/* 사진 비교 */}
      <section className="photos-section">
        <div className="photo-card">
          <div className="photo-label">👤 내 사진</div>
          <img src={image} alt="본인 사진" className="result-photo" />
        </div>
        <div className="photo-arrow">→</div>
        <div className="photo-card featured">
          <div className="photo-label">🚗 추천 차량</div>
          <img src={result.carImageUrl} alt={result.carName} className="result-photo" />
        </div>
      </section>

      {/* 추천 차량 타이틀 */}
      <section className="car-title-section">
        <div className="car-badge">{result.category}</div>
        <h1 className="car-name">{result.carNameKo || result.carName}</h1>
        <p className="car-name-en">{result.carName}</p>
        <div className="car-tags">
          {result.styleKeywords?.map((kw, i) => (
            <span key={i} className="car-tag">#{kw}</span>
          ))}
        </div>
        <div className="car-price">💰 {result.priceRange}</div>
      </section>

      {/* 보고서 */}
      <section className="report-section">
        <div className="report-card">
          <h3 className="report-heading">🪞 이미지 분석</h3>
          <p className="report-text">{result.personality}</p>
        </div>
        <div className="report-card">
          <h3 className="report-heading">🎯 추천 이유</h3>
          <p className="report-text">{result.reason}</p>
        </div>
        <div className="report-card full">
          <h3 className="report-heading">📋 상세 추천 보고서</h3>
          <p className="report-text">{result.report}</p>
        </div>
      </section>
      </div>

      <div className="result-actions">
        <button className="btn-primary retry-btn" onClick={reset}>
          🔄 다시 분석하기
        </button>
        <button className="btn-share" onClick={handleShare} disabled={sharing}>
          {sharing ? '⏳ 처리 중...' : '🖼 이미지 공유'}
        </button>
      </div>
      {shareMsg && <p className="share-msg">{shareMsg}</p>}
    </div>
  )
}
