import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import './CameraView.css';

// face-api.js modellari CDN orqali yuklanadi
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

const CameraView = ({ onStudentPresenceChange }) => {
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const streamRef      = useRef(null);
  const intervalRef    = useRef(null);
  const alertTimeRef   = useRef(null);

  const [status, setStatus]               = useState('loading'); // loading | ready | detecting | error
  const [modelsLoaded, setModelsLoaded]   = useState(false);
  const [cameraActive, setCameraActive]   = useState(false);
  const [isStudentPresent, setIsStudentPresent] = useState(false);
  const [faceCount, setFaceCount]         = useState(0);
  const [showAlert, setShowAlert]         = useState(false);
  const [alertMessage, setAlertMessage]   = useState('');
  const [loadingStep, setLoadingStep]     = useState('');
  const [detectionStats, setDetectionStats] = useState({ confidence: 0, fps: 0 });
  const [isCameraOff, setIsCameraOff]     = useState(false);

  // ── 1. face-api.js modellarini yuklash ──────────────────────────────────────
  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatus('loading');
        setLoadingStep("AI modellar yuklanmoqda...");

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        setLoadingStep("Yuz tanish modeli yuklandi ✓");

        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        setLoadingStep("Landmark modeli yuklandi ✓");

        await faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL);
        setLoadingStep("Ifoda modeli yuklandi ✓ | Kamera ishga tushirilmoqda...");

        setModelsLoaded(true);
        setStatus('ready');
      } catch (err) {
        console.error('face-api.js modellari yuklanmadi:', err);
        setStatus('error');
        setLoadingStep('Model yuklanmadi. Internet aloqasini tekshiring.');
      }
    };

    loadModels();

    return () => {
      stopCamera();
    };
  }, []);

  // ── 2. Modellar yuklangandan so'ng kamerani avtomatik ishga tushirish ───────
  useEffect(() => {
    if (modelsLoaded) {
      startCamera();
    }
  }, [modelsLoaded]);

  // ── 3. Kamerani yoqish ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setIsCameraOff(false);
        setStatus('detecting');
        startDetection();
      }
    } catch (err) {
      console.error('Kamera xatosi:', err);
      setStatus('error');

      if (err.name === 'NotAllowedError') {
        setLoadingStep('Kamera ruxsati berilmadi. Brauzer sozlamalarini tekshiring.');
      } else if (err.name === 'NotFoundError') {
        setLoadingStep('Kamera topilmadi. Qurilmangizda kamera mavjudligini tekshiring.');
      } else {
        setLoadingStep('Kamerani yoqib bo\'lmadi: ' + err.message);
      }
    }
  }, []);

  // ── 4. Kamerani o'chirish ────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsCameraOff(true);
    setIsStudentPresent(false);
    setFaceCount(0);
    onStudentPresenceChange?.(false);

    // Canvasni tozalash
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [onStudentPresenceChange]);

  // ── 5. Yuz aniqlash tsikli ───────────────────────────────────────────────────
  const startDetection = useCallback(() => {
    let frameCount = 0;
    let lastTime = Date.now();

    intervalRef.current = setInterval(async () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2 || video.paused) return;

      try {
        // Canvas o'lchamini video bilan moslashtirish
        const displaySize = {
          width:  video.videoWidth  || video.clientWidth,
          height: video.videoHeight || video.clientHeight,
        };
        faceapi.matchDimensions(canvas, displaySize);

        // Yuzlarni aniqlash (landmark + ifoda bilan)
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceLandmarks(true)
          .withFaceExpressions();

        // Natijalarni canvas o'lchamiga moslashtirish
        const resized = faceapi.resizeResults(detections, displaySize);

        // Canvasni tozalash va chizish
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length > 0) {
          // Yuz ramkalarini chizish
          resized.forEach(det => {
            const { x, y, width, height } = det.detection.box;
            const confidence = det.detection.score;

            // Gradient ramka
            const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(0.5, '#8b5cf6');
            gradient.addColorStop(1, '#06b6d4');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 12;
            ctx.strokeRect(x, y, width, height);
            ctx.shadowBlur = 0;

            // Burchak belgilar
            const cornerLen = 18;
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 3;
            [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].forEach(([cx, cy], i) => {
              ctx.beginPath();
              const dx = i % 2 === 0 ? 1 : -1;
              const dy = i < 2 ? 1 : -1;
              ctx.moveTo(cx, cy + dy * cornerLen);
              ctx.lineTo(cx, cy);
              ctx.lineTo(cx + dx * cornerLen, cy);
              ctx.stroke();
            });

            // Ishonch ko'rsatkichi
            ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
            ctx.roundRect?.(x, y - 26, 100, 22, 4);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.fillText(`${Math.round(confidence * 100)}%`, x + 6, y - 10);
          });

          // Landmark nuqtalarini chizish
          faceapi.draw.drawFaceLandmarks(canvas, resized);
        }

        // FPS hisoblash
        frameCount++;
        const now = Date.now();
        if (now - lastTime >= 1000) {
          setDetectionStats({
            fps: frameCount,
            confidence: resized[0]?.detection?.score
              ? Math.round(resized[0].detection.score * 100)
              : 0,
          });
          frameCount = 0;
          lastTime = now;
        }

        // O'quvchi holati
        const detected = resized.length > 0;
        setFaceCount(resized.length);

        if (detected !== isStudentPresent) {
          setIsStudentPresent(detected);
          onStudentPresenceChange?.(detected);

          if (detected) {
            triggerAlert("✅ O'quvchi aniqlandi. Darsni boshlaymiz! 🎓");
          }
        }
      } catch (err) {
        // Aniqlash xatosi — davom etadi
      }
    }, 200); // 5 FPS aniqlash
  }, [isStudentPresent, onStudentPresenceChange]);

  // ── 6. Alert ko'rsatish ──────────────────────────────────────────────────────
  const triggerAlert = (msg) => {
    setAlertMessage(msg);
    setShowAlert(true);

    if (alertTimeRef.current) clearTimeout(alertTimeRef.current);
    alertTimeRef.current = setTimeout(() => setShowAlert(false), 4000);
  };

  // ── 7. Kamerani yoqish/o'chirish ─────────────────────────────────────────────
  const handleToggleCamera = () => {
    if (cameraActive) {
      stopCamera();
      setStatus('ready');
    } else {
      setStatus('detecting');
      startCamera();
    }
  };

  return (
    <div className="camera-view">
      {/* Sarlavha */}
      <div className="camera-header">
        <div className="camera-title">
          <div className={`status-indicator ${status === 'detecting' ? 'detecting' : status === 'error' ? 'error' : 'idle'}`}>
            <span className="pulse-dot" style={{
              background: status === 'detecting' ? '#10b981' : status === 'error' ? '#f43f5e' : '#f59e0b',
            }}></span>
          </div>
          <span>Yuz Skaneri</span>
        </div>

        <div className="camera-badges">
          {isStudentPresent && (
            <span className="badge badge-success">
              👤 {faceCount} O'quvchi
            </span>
          )}
          {status === 'detecting' && (
            <span className="badge badge-info">
              {detectionStats.fps} FPS
            </span>
          )}
        </div>
      </div>

      {/* Video oyna */}
      <div className="camera-viewport">
        {/* Yuklash ekrani */}
        {status === 'loading' && (
          <div className="camera-overlay loading-overlay">
            <div className="loading-spinner"></div>
            <p className="loading-text">{loadingStep}</p>
          </div>
        )}

        {/* Kamera o'chirilgan */}
        {isCameraOff && status !== 'loading' && (
          <div className="camera-overlay camera-off-overlay">
            <div className="camera-off-icon">📷</div>
            <p>Kamera o'chirilgan</p>
            <button className="btn btn-primary" onClick={handleToggleCamera} style={{ marginTop: '1rem' }}>
              Yoqish
            </button>
          </div>
        )}

        {/* Xato ekrani */}
        {status === 'error' && (
          <div className="camera-overlay error-overlay">
            <div className="error-icon">⚠️</div>
            <p className="error-text">{loadingStep}</p>
            <button className="btn btn-primary" onClick={startCamera} style={{ marginTop: '1rem' }}>
              Qayta urinish
            </button>
          </div>
        )}

        {/* Video stream */}
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          playsInline
          muted
          style={{ display: cameraActive ? 'block' : 'none' }}
        />

        {/* Aniqlash canvasi */}
        <canvas
          ref={canvasRef}
          className="detection-canvas"
          style={{ display: cameraActive ? 'block' : 'none' }}
        />

        {/* Yuz aniqlanganda glow efekti */}
        {isStudentPresent && <div className="face-detected-glow" />}

        {/* Korner dekoratsiyalar */}
        <div className="viewport-corner corner-tl" />
        <div className="viewport-corner corner-tr" />
        <div className="viewport-corner corner-bl" />
        <div className="viewport-corner corner-br" />

        {/* FPS va ishonch ko'rsatkichi */}
        {cameraActive && (
          <div className="detection-hud">
            <div className="hud-item">
              <span className="hud-label">FPS</span>
              <span className="hud-value">{detectionStats.fps}</span>
            </div>
            {isStudentPresent && (
              <div className="hud-item">
                <span className="hud-label">ISHONCH</span>
                <span className="hud-value">{detectionStats.confidence}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert xabarnoma */}
      <div className={`detection-alert ${showAlert ? 'show' : ''}`}>
        <span className="alert-icon">🎓</span>
        <span className="alert-text">{alertMessage}</span>
      </div>

      {/* Holat paneli */}
      <div className="camera-status-bar">
        <div className="status-info">
          <div className={`presence-indicator ${isStudentPresent ? 'present' : 'absent'}`}>
            <span>{isStudentPresent ? '✅ Hozir darsdaman' : '⭕ Kutilmoqda...'}</span>
          </div>
        </div>

        {/* Kamerani yoqish/o'chirish */}
        <button
          className={`btn ${cameraActive ? 'btn-danger' : 'btn-primary'} btn-sm`}
          onClick={handleToggleCamera}
          disabled={status === 'loading'}
        >
          {cameraActive ? '🔴 O\'chirish' : '🟢 Yoqish'}
        </button>
      </div>
    </div>
  );
};

export default CameraView;
