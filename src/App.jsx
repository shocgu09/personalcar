import { useState, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <div className="logo">🚗 CarFit</div>
        <p className="logo-sub">AI 퍼스널 차 추천</p>
      </header>

      {/* 히어로 */}
      <section className="hero">
        <div className="badge">✨ AI 기반 분석</div>
        <h1>
          나에게 <span className="accent">딱 맞는 차</span>를<br />
          찾아드립니다
        </h1>
        <p className="hero-desc">
          본인 사진 한 장으로 얼굴형, 스타일, 분위기를 분석해<br />
          퍼스널 맞춤 차량을 추천해드립니다.
        </p>
      </section>

      {/* 업로드 영역 */}
      <section className="upload-section">
        <div
          className={`upload-box ${isDragging ? 'dragging' : ''} ${image ? 'has-image' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !image && fileInputRef.current.click()}
        >
          {image ? (
            <div className="preview-wrap">
              <img src={image} alt="업로드된 사진" className="preview-img" />
              <button
                className="remove-btn"
                onClick={(e) => { e.stopPropagation(); setImage(null) }}
              >✕</button>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">📷</div>
              <p className="upload-title">사진을 드래그하거나 클릭해서 업로드</p>
              <p className="upload-hint">JPG, PNG, WEBP · 최대 10MB</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {/* 버튼 영역 */}
        <div className="btn-group">
          {image && (
            <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>
              📁 다시 선택
            </button>
          )}
          <button
            className={`btn-primary ${!image ? 'disabled' : ''}`}
            disabled={!image}
          >
            {image ? '🔍 차량 추천받기' : '사진을 먼저 업로드해주세요'}
          </button>
        </div>

        {/* 안내 문구 */}
        {!image && (
          <div className="tips">
            <div className="tip">💡 정면 사진일수록 정확도가 높아요</div>
            <div className="tip">🔒 사진은 분석 후 즉시 삭제됩니다</div>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
