import { useState, useRef, useCallback } from 'react'
import './App.css'

/* 이미지 압축 (800px, JPEG 85%) */
function compressImage(dataUrl, maxPx = 800) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
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
  const [step, setStep] = useState('upload')   // upload | loading | result
  const [image, setImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const fileInputRef = useRef(null)

  /* 파일 처리 */
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '분석 실패')
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

  /* ── UPLOAD ── */
  if (step === 'upload') return (
    <div className="app">
      <header className="header">
        <div className="logo">🚗 CarFit</div>
        <p className="logo-sub">AI 퍼스널 차 추천</p>
      </header>

      <section className="hero">
        <div className="badge">✨ AI 기반 분석</div>
        <h1>나에게 <span className="accent">딱 맞는 차</span>를<br />찾아드립니다</h1>
        <p className="hero-desc">
          본인 사진 한 장으로 얼굴형, 스타일, 분위기를 분석해<br />
          퍼스널 맞춤 차량을 추천해드립니다.
        </p>
      </section>

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
            disabled={!image} onClick={handleAnalyze}>
            {image ? '🔍 차량 추천받기' : '사진을 먼저 업로드해주세요'}
          </button>
        </div>

        {!image && (
          <div className="tips">
            <div className="tip">💡 정면 사진일수록 정확도가 높아요</div>
            <div className="tip">🔒 사진은 분석 후 즉시 삭제됩니다</div>
          </div>
        )}
      </section>
    </div>
  )

  /* ── LOADING ── */
  if (step === 'loading') return (
    <div className="app loading-app">
      <div className="loading-wrap">
        <div className="loading-spinner" />
        <h2 className="loading-title">분석 중입니다</h2>
        <div className="loading-steps">
          {LOADING_STEPS.map((s, i) => (
            <div key={i} className={`loading-step${i <= loadingStep ? ' active' : ''}${i < loadingStep ? ' done' : ''}`}>
              <span className="step-icon">{i < loadingStep ? '✅' : s.icon}</span>
              <span className="step-text">{s.text}</span>
            </div>
          ))}
        </div>
        <p className="loading-hint">약 20~30초 소요됩니다</p>
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

      <button className="btn-primary retry-btn" onClick={reset}>
        🔄 다른 사진으로 다시 분석하기
      </button>
    </div>
  )
}
