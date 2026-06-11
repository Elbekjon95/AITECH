import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import './CameraView.css';

// face-api.js modellari CDN orqali yuklanadi
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

const CameraView = ({ students, onStudentRecognized, onStudentPresenceChange }) => {
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
  
  // Yuz solishtiruvchi FaceMatcher va uning holati
  const [faceMatcher, setFaceMatcher]     = useState(null);
  const [matcherLoading, setMatcherLoading] = useState(false);

  // Closure muammosini hal qilish uchun ref-lar
  const faceMatcherRef        = useRef(null);
  const studentsRef           = useRef([]);
  const lastRecognizedIdRef   = useRef(null);  // so'nggi tanilgan o'quvchi ID
  const lastRecognizedTimeRef = useRef(0);      // so'nggi tanilgan vaqt (ms)
  const isStudentPresentRef   = useRef(false);  // presence holati ref orqali
  const onPresenceChangeRef   = useRef(onStudentPresenceChange);
  const onRecognizedRef       = useRef(onStudentRecognized);

  // Callback ref-larni har render da yangilab borish
  useEffect(() => { onPresenceChangeRef.current = onStudentPresenceChange; });
  useEffect(() => { onRecognizedRef.current = onStudentRecognized; });

  // ── 1. face-api.js modellarini yuklash ──────────────────────────────────────
  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatus('loading');
        setLoadingStep("AI modellar yuklanmoqda...");

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        setLoadingStep("Yuz aniqlash modeli yuklandi ✓");

        await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
        setLoadingStep("Landmark modeli yuklandi ✓");

        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
        setLoadingStep("Yuz tanish modeli yuklandi ✓");

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

  // ── 2. O'quvchi rasmidan yuz deskriptorini olish (Helper) ──────────────────────
  const getDescriptorFromPhoto = (photoBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      // base64 uchun crossOrigin KERAK EMAS — olib tashlaymiz
      img.onload = async () => {
        try {
          // Rasmni canvas ga chizib o'lchamini moslashtirish
          // (juda katta rasm TinyFaceDetector bilan muammo qilishi mumkin)
          const MAX_SIZE = 640;
          let { naturalWidth: w, naturalHeight: h } = img;
          const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1);
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);

          const offCanvas = document.createElement('canvas');
          offCanvas.width  = cw;
          offCanvas.height = ch;
          const ctx = offCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);

          console.log(`[FaceAPI] Rasm o'lchami: ${w}x${h} → canvas: ${cw}x${ch}`);

          // Har xil threshold bilan urinib ko'rish
          let detection = null;
          for (const threshold of [0.3, 0.2, 0.15]) {
            detection = await faceapi
              .detectSingleFace(offCanvas, new faceapi.TinyFaceDetectorOptions({
                scoreThreshold: threshold,
                inputSize: 320,
              }))
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (detection) {
              console.log(`[FaceAPI] ✅ Yuz aniqlandi! Score: ${detection.detection.score.toFixed(3)}, threshold: ${threshold}`);
              break;
            } else {
              console.warn(`[FaceAPI] ⚠️ threshold ${threshold} bilan yuz topilmadi`);
            }
          }

          if (!detection) {
            console.error(`[FaceAPI] ❌ Rasmda yuz topilmadi. Iltimos yuzni to'g'ridan va aniq tushgan rasmdan foydalaning.`);
          }

          resolve(detection ? detection.descriptor : null);
        } catch (err) {
          console.error('[FaceAPI] Descriptor extraction xatosi:', err);
          resolve(null);
        }
      };
      img.onerror = (e) => {
        console.error('[FaceAPI] Rasm yuklanmadi:', e);
        resolve(null);
      };
      img.src = photoBase64;
    });
  };

   // ── 3. O'quvchilar ro'yxatidan FaceMatcher tayyorlash ──────────────────────────
  useEffect(() => {
    const initMatcher = async () => {
      if (!modelsLoaded || !students || students.length === 0) {
        setFaceMatcher(null);
        faceMatcherRef.current = null;
        console.log('[FaceAPI] FaceMatcher tozalandi (o\'quvchi yo\'q yoki model yuklanmagan)');
        return;
      }

      const studentsWithPhoto = students.filter(s => s.photo);
      console.log(`[FaceAPI] Descriptor yaratish boshlandi. Rasmli o'quvchilar: ${studentsWithPhoto.length}/${students.length}`);

      if (studentsWithPhoto.length === 0) {
        console.warn('[FaceAPI] Birorta o\'quvchida rasm yo\'q! Yuz tanish ishlamaydi.');
        setFaceMatcher(null);
        faceMatcherRef.current = null;
        return;
      }

      try {
        setMatcherLoading(true);
        setStatus('loading');
        setLoadingStep("O'quvchilar rasmlari tahlil qilinmoqda...");

        const labeledDescriptors = [];
        for (const student of studentsWithPhoto) {
          console.log(`[FaceAPI] ⏳ ${student.firstName} ${student.lastName} rasmi tahlil qilinmoqda...`);
          const descriptor = await getDescriptorFromPhoto(student.photo);
          if (descriptor) {
          // LabeledFaceDescriptors label ALBATTA string bo'lishi shart!
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(String(student._id || student.id), [descriptor])
            );
            console.log(`[FaceAPI] ✅ ${student.firstName} ${student.lastName}: descriptor tayyor (id: ${String(student._id || student.id)})`);

          } else {
            console.warn(`[FaceAPI] ❌ ${student.firstName} ${student.lastName}: rasmdan yuz topilmadi! Boshqa rasm yuklang.`);
          }
        }

        if (labeledDescriptors.length > 0) {
          // 0.6 threshold (kichikroq = qattiqroq, kattaroq = yumshoqroq)
          const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
          setFaceMatcher(matcher);
          faceMatcherRef.current = matcher;
          console.log(`[FaceAPI] 🎉 FaceMatcher tayyor! Taniydigan o'quvchilar: ${labeledDescriptors.length}/${studentsWithPhoto.length}`);
        } else {
          setFaceMatcher(null);
          faceMatcherRef.current = null;
          console.error('[FaceAPI] Hech bir rasmdan descriptor olinmadi! Yuz aniq tushgan rasmlardan foydalaning.');
        }
        setStatus('ready');
      } catch (err) {
        console.error("FaceMatcher yaratib bo'lmadi:", err);
        setStatus('ready');
      } finally {
        setMatcherLoading(false);
      }
    };

    initMatcher();
  }, [modelsLoaded, students]);

  // studentsRef ni yangilab borish
  useEffect(() => {
    studentsRef.current = students || [];
  }, [students]);

  // ── 4. Modellar yuklangandan so'ng kamerani avtomatik ishga tushirish ───────
  useEffect(() => {
    if (modelsLoaded && !matcherLoading) {
      startCamera();
    }
  }, [modelsLoaded, matcherLoading]);

  // ── 5. Kamerani yoqish ───────────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 6. Kamerani o'chirish ────────────────────────────────────────────────────
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
    isStudentPresentRef.current = false;
    setIsStudentPresent(false);
    setFaceCount(0);
    onPresenceChangeRef.current?.(false);
    
    // Seans bo'yicha tanish ref-larini tozalash
    lastRecognizedIdRef.current = null;
    lastRecognizedTimeRef.current = 0;

    // Canvasni tozalash
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 7. Yuz aniqlash va solishtirish tsikli ───────────────────────────────────
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

        // Yuzlarni landmark va descriptorlari bilan aniqlash
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        // Natijalarni canvas o'lchamiga moslashtirish
        const resized = faceapi.resizeResults(detections, displaySize);

        // Canvasni tozalash
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let recognizedAnyStudent = null;

        if (resized.length > 0) {
          resized.forEach(det => {
            const { x, y, width, height } = det.detection.box;
            const confidence = det.detection.score;
            const descriptor = det.descriptor;

            let label = "Noma'lum o'quvchi";
            let isRecognized = false;

            // FaceMatcher orqali tanish — ref orqali eng so'nggi matcherni olish
            if (faceMatcherRef.current) {
              const bestMatch = faceMatcherRef.current.findBestMatch(descriptor);
              if (bestMatch.label !== 'unknown') {
                // String() bilan solishtirish — _id ObjectId bo'lishi mumkin
                const found = studentsRef.current.find(
                  s => String(s._id || s.id) === bestMatch.label
                );
                if (found) {
                  label = `${found.firstName} ${found.lastName}`;
                  isRecognized = true;
                  recognizedAnyStudent = found;
                }
              }
            }

            // Gradient ramka chizish
            const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
            if (isRecognized) {
              // Yashil rang (tanilsa)
              gradient.addColorStop(0, '#10b981');
              gradient.addColorStop(0.5, '#059669');
              gradient.addColorStop(1, '#06b6d4');
            } else {
              // Sariq rang (yuz bor, lekin bazada yo'q yoki tanilmadi)
              gradient.addColorStop(0, '#f59e0b');
              gradient.addColorStop(0.5, '#d97706');
              gradient.addColorStop(1, '#f59e0b');
            }

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = isRecognized ? '#10b981' : '#f59e0b';
            ctx.shadowBlur = 12;
            ctx.strokeRect(x, y, width, height);
            ctx.shadowBlur = 0;

            // Burchak belgilar
            const cornerLen = 18;
            ctx.strokeStyle = isRecognized ? '#34d399' : '#fbbf24';
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

            // Tizimdagi nomi va ishonch ko'rsatkichi
            ctx.fillStyle = isRecognized ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)';
            const labelWidth = Math.max(120, label.length * 7.5 + 20);
            ctx.roundRect?.(x, y - 26, labelWidth, 22, 4);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.fillText(isRecognized ? `🎓 ${label}` : `👁️ ${label}`, x + 6, y - 10);
          });

          // Landmarklarni chizish
          faceapi.draw.drawFaceLandmarks(canvas, resized);
        }

        // FPS va hisoblash statislari
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

        // O'quvchi aniqlanganligini qayd etish
        const detected = resized.length > 0;
        setFaceCount(resized.length);

        if (detected !== isStudentPresentRef.current) {
          isStudentPresentRef.current = detected;
          setIsStudentPresent(detected);
          onPresenceChangeRef.current?.(detected);

          if (detected) {
            if (recognizedAnyStudent) {
              triggerAlert(`✅ Tanildi: ${recognizedAnyStudent.firstName} ${recognizedAnyStudent.lastName}! 🎓`);
            } else {
              triggerAlert("👁️ Yuz aniqlandi. Tanishga urinilmoqda...");
            }
          }
        }

        // Agar o'quvchi haqiqiy tanilgan bo'lsa — faqat bir marta (o'quvchi o'zgarganda) xabar ber
        if (recognizedAnyStudent) {
          const studentId = String(recognizedAnyStudent._id || recognizedAnyStudent.id);
          const diffId   = lastRecognizedIdRef.current !== studentId;
          if (diffId) {
            lastRecognizedIdRef.current   = studentId;
            lastRecognizedTimeRef.current = Date.now();
            onRecognizedRef.current?.(recognizedAnyStudent);

            // O'quvchi aniqlangandan so'ng kamerani 1 soniya kechikish bilan to'xtatish
            setTimeout(() => {
              stopCamera();
            }, 1000);
          }
        }

      } catch (err) {
        console.error("Yuz skanerlashda xatolik:", err);
      }
    }, 250); // 4 FPS (tizimni yuklamaslik uchun optimal tezlik)
  // faqat mount/unmount paytida yaratiladi — ref orqali eng yangi qiymatlarni oladi
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 8. Alert ko'rsatish ──────────────────────────────────────────────────────
  const triggerAlert = (msg) => {
    setAlertMessage(msg);
    setShowAlert(true);

    if (alertTimeRef.current) clearTimeout(alertTimeRef.current);
    alertTimeRef.current = setTimeout(() => setShowAlert(false), 4000);
  };

  // ── 9. Kamerani yoqish/o'chirish ─────────────────────────────────────────────
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
              👤 {faceCount} Yuz
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
            <span>{isStudentPresent ? '✅ O\'quvchi aniqlandi' : '⭕ Skaner kutilmoqda...'}</span>
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
