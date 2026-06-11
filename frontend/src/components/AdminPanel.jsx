import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import CameraView from './CameraView';
import './AdminPanel.css';

const AdminPanel = ({ onClose, onStudentSelect, currentStudent, onStudentPresenceChange }) => {
  const [students,     setStudents]     = useState([]);
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64,  setPhotoBase64]  = useState(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');
  const [tab,          setTab]          = useState('camera');
  
  // Kamera yuz aniqlash holati
  const [faceDetected, setFaceDetected] = useState(false);
  // Rasm yuz tekshiruvi holati: null | 'checking' | 'ok' | 'no-face'
  const [photoFaceStatus, setPhotoFaceStatus] = useState(null);
  // "Tanildi" animatsiyasi uchun
  const [justRecognized, setJustRecognized] = useState(false);
  
  // Tahrirlash holati
  const [editingStudent, setEditingStudent] = useState(null);

  const fileRef = useRef(null);
  const recognizedTimerRef = useRef(null);

  // ── O'quvchilarni yuklash ────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    try {
      const res  = await fetch('/api/students');
      const data = await res.json();
      if (data.success) setStudents(data.students);
    } catch (_) {}
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ── Kamera yuz holatini boshqarish ──────────────────────────────────────────
  const handlePresenceChange = useCallback((present) => {
    setFaceDetected(present);
    onStudentPresenceChange?.(present);

    if (present && currentStudent) {
      setJustRecognized(true);
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = setTimeout(() => setJustRecognized(false), 3000);
    }
  }, [currentStudent, onStudentPresenceChange]);

  // Avtomatik yuz mosligi aniqlanganda chaqiriladi
  const handleStudentRecognized = useCallback((recognizedStudent) => {
    const curId = currentStudent ? String(currentStudent._id || currentStudent.id) : null;
    const recId = String(recognizedStudent._id || recognizedStudent.id);
    if (curId === recId) return;
    
    // Tizimda o'quvchini tanlash
    onStudentSelect(recognizedStudent);
    
    // "Tanildi" bannerini ko'rsatish
    setJustRecognized(true);
    if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
    recognizedTimerRef.current = setTimeout(() => setJustRecognized(false), 4000);
  }, [currentStudent, onStudentSelect]);

  useEffect(() => {
    return () => { if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current); };
  }, []);

  // ── Rasm tanlash va yuz tekshiruvi ───────────────────────────────────────────
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 640;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(MAX / w, MAX / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const checkFaceInPhoto = async (base64) => {
    if (!base64) return;
    setPhotoFaceStatus('checking');
    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = base64;
      });
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.2, inputSize: 320 }))
        .withFaceLandmarks();
      setPhotoFaceStatus(detection ? 'ok' : 'no-face');
    } catch {
      setPhotoFaceStatus('no-face');
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Rasm hajmi 5MB dan oshmasligi kerak.');
      return;
    }
    setError('');
    setPhotoFaceStatus(null);
    const compressed = await compressImage(file);
    if (!compressed) {
      setError('Rasmni o\'qib bo\'lmadi.');
      return;
    }
    setPhotoPreview(compressed);
    setPhotoBase64(compressed);
    checkFaceInPhoto(compressed);
  };

  // ── O'quvchi qo'shish / tahrirlash ───────────────────────────────────────────
  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Ism va familiya kiritilishi shart!");
      return;
    }
    setIsLoading(true);
    setError('');

    const isEdit = !!editingStudent;
    const url = isEdit ? `/api/students/${editingStudent._id || editingStudent.id}` : '/api/students';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res  = await fetch(url, {
        method:  method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          photo:     photoBase64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setStudents(prev => prev.map(s => {
            const sId = s._id || s.id;
            const editId = editingStudent._id || editingStudent.id;
            return String(sId) === String(editId) ? data.student : s;
          }));
          
          const curId = currentStudent ? String(currentStudent._id || currentStudent.id) : null;
          const editId = String(editingStudent._id || editingStudent.id);
          if (curId === editId) {
            onStudentSelect(data.student);
          }
          cancelEdit();
        } else {
          setStudents(prev => [data.student, ...prev]);
          setFirstName('');
          setLastName('');
          setPhotoPreview(null);
          setPhotoBase64(null);
          if (fileRef.current) fileRef.current.value = '';
        }
        setError('');
      } else {
        setError(data.error || "Xato yuz berdi.");
      }
    } catch (_) {
      setError("Server bilan aloqa yo'q.");
    } finally {
      setIsLoading(false);
    }
  };

  // Tahrirlashni boshlash
  const startEdit = (student) => {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setPhotoPreview(student.photo);
    setPhotoBase64(student.photo);
    setPhotoFaceStatus(student.photo ? 'ok' : null);
    setError('');
  };

  // Tahrirlashni bekor qilish
  const cancelEdit = () => {
    setEditingStudent(null);
    setFirstName('');
    setLastName('');
    setPhotoPreview(null);
    setPhotoBase64(null);
    setPhotoFaceStatus(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── O'quvchi o'chirish ────────────────────────────────────────────────────────
  const handleDelete = async (student) => {
    const sId = student._id || student.id;
    if (!window.confirm(`${student.firstName} ${student.lastName}ni tizimdan o'chirishni tasdiqlaysizmi?`)) return;
    try {
      const res = await fetch(`/api/students/${sId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => prev.filter(s => String(s._id || s.id) !== String(sId)));
        const curId = currentStudent ? String(currentStudent._id || currentStudent.id) : null;
        if (curId === String(sId)) onStudentSelect(null);
      }
    } catch (_) {}
  };

  // ── O'quvchi tanlash (panel yopilmaydi, kamerada ko'rinish uchun) ─────────────
  const handleSelect = (student) => {
    onStudentSelect(student);
    setTab('camera');
  };

  // ── O'quvchi bilan darsni boshlash (panel yopiladi) ──────────────────────────
  const handleStartLesson = (student) => {
    onStudentSelect(student);
    onClose();
  };

  // ── Statistika Tahlili ───────────────────────────────────────────────────────
  const totalStudents = students.length;
  const withPhoto = students.filter(s => s.photo).length;
  const withoutPhoto = totalStudents - withPhoto;
  const photoPercentage = totalStudents > 0 ? Math.round((withPhoto / totalStudents) * 100) : 0;
  
  const recentStudents = students.filter(s => {
    const createdDate = new Date(s.createdAt);
    const diffTime = Math.abs(new Date() - createdDate);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return diffHours <= 24;
  }).length;

  return (
    <div className="admin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-panel">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="admin-header">
          <div className="admin-title">
            <span className="admin-icon">⚙️</span>
            <div>
              <h2>Admin Panel</h2>
              <p>Tizim boshqaruvi va o'quvchilar nazorati</p>
            </div>
          </div>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {/* ─── Tab navigatsiyasi ───────────────────────────────────────────── */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'camera' ? 'active' : ''}`}
            onClick={() => setTab('camera')}
          >
            📷 Yuz Skaneri
          </button>
          <button
            className={`admin-tab ${tab === 'students' ? 'active' : ''}`}
            onClick={() => setTab('students')}
          >
            👥 O'quvchilar Analitikasi ({totalStudents})
          </button>
        </div>

        {/* ─── Tab: Kamera ────────────────────────────────────────────────── */}
        {tab === 'camera' && (
          <div className="admin-camera-section">

            {/* "Tanildi" banneri */}
            {justRecognized && currentStudent && (
              <div className="recognized-banner">
                <span className="recognized-glow">✅</span>
                <div>
                  <div className="recognized-name">
                    {currentStudent.firstName} {currentStudent.lastName}
                  </div>
                  <div className="recognized-label">tizim tomonidan tanildi!</div>
                </div>
              </div>
            )}

            {/* Kamera bloki */}
            <div className="camera-wrapper">
              <CameraView 
                students={students} 
                onStudentRecognized={handleStudentRecognized} 
                onStudentPresenceChange={handlePresenceChange} 
              />
            </div>

            {/* O'quvchi ma'lumoti + kamera holati */}
            <div className="camera-status-info">
              {currentStudent ? (
                <div className={`current-student-badge ${faceDetected ? 'face-active' : ''}`}>
                  <div className="badge-photo-wrap">
                    {currentStudent.photo
                      ? <img src={currentStudent.photo} alt="student" className="badge-photo" />
                      : <div className="badge-avatar">👤</div>
                    }
                    <span className={`face-dot ${faceDetected ? 'detected' : 'waiting'}`} />
                  </div>
                  <div className="badge-info">
                    <div className="badge-name">
                      {currentStudent.firstName} {currentStudent.lastName}
                    </div>
                    <div className={`badge-status ${faceDetected ? 'present' : 'absent'}`}>
                      {faceDetected
                        ? '✅ Kamera ko\'rmoqda — tizim tanidi!'
                        : '👁️ Kamera oldiga keling...'}
                    </div>
                  </div>
                  <button
                    className="start-lesson-btn"
                    onClick={() => handleStartLesson(currentStudent)}
                  >
                    ▶ Darsni boshlash
                  </button>
                </div>
              ) : (
                <div className="no-student-hint">
                  <span>👉</span>
                  <span>
                    <strong>O'quvchilar</strong> tabida o'quvchi tanlang yoki skaner orqali yuzni taniy oldiring!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Tab: O'quvchilar ────────────────────────────────────────────── */}
        {tab === 'students' && (
          <div className="admin-students-section">

            {/* Tahlil paneli (Dashboard) */}
            <div className="analytics-dashboard">
              <div className="analytics-card">
                <span className="analytics-card-icon">👥</span>
                <div className="analytics-card-info">
                  <div className="analytics-value">{totalStudents}</div>
                  <div className="analytics-label">Jami o'quvchilar</div>
                </div>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-icon">✅</span>
                <div className="analytics-card-info">
                  <div className="analytics-value">{withPhoto} <span className="analytics-perc">({photoPercentage}%)</span></div>
                  <div className="analytics-label">Kamerada taniladiganlar</div>
                </div>
              </div>
              <div className="analytics-card warning">
                <span className="analytics-card-icon">⚠️</span>
                <div className="analytics-card-info">
                  <div className="analytics-value">{withoutPhoto}</div>
                  <div className="analytics-label">Rasmsiz o'quvchilar</div>
                </div>
              </div>
              <div className="analytics-card success">
                <span className="analytics-card-icon">🆕</span>
                <div className="analytics-card-info">
                  <div className="analytics-value">{recentStudents}</div>
                  <div className="analytics-label">Yangi qo'shilganlar (24s)</div>
                </div>
              </div>
            </div>

            {/* O'quvchi qo'shish / tahrirlash formasi */}
            <form className="add-student-form" onSubmit={handleSaveStudent}>
              <h3 className="form-title">
                {editingStudent ? '✏️ O\'quvchi ma\'lumotlarini tahrirlash' : '➕ Yangi o\'quvchi qo\'shish'}
              </h3>

              {/* Rasm yuklash */}
              <div className="photo-upload-area" onClick={() => fileRef.current?.click()}>
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="preview" className="photo-preview" />
                    <div className={`face-check-status face-check-${photoFaceStatus || 'idle'}`}>
                      {photoFaceStatus === 'checking' && <><span className="fc-spin">⏳</span> Yuz tekshirilmoqda...</>}
                      {photoFaceStatus === 'ok'       && <><span>✅</span> Yuz aniqlandi — tanish ishlaydi</>}
                      {photoFaceStatus === 'no-face'  && <><span>⚠️</span> Yuz topilmadi — boshqa rasm tanlang</>}
                    </div>
                  </>
                ) : (
                  <div className="photo-placeholder">
                    <span>📷</span>
                    <span>Rasm yuklash</span>
                    <span className="photo-hint">PNG, JPG • Yuz to'g'ri tushgan rasm</span>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ism</label>
                  <input
                    type="text"
                    placeholder="Masalan: Jasur"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="admin-input"
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Familiya</label>
                  <input
                    type="text"
                    placeholder="Masalan: Karimov"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="admin-input"
                    maxLength={50}
                  />
                </div>
              </div>

              {error && <div className="form-error">⚠️ {error}</div>}
              {photoFaceStatus === 'no-face' && (
                <div className="form-warn">
                  ⚠️ Rasmda yuz aniqlanmadi. Tizim yuzni taniy olmasligi mumkin.
                </div>
              )}

              <div className="form-actions">
                {editingStudent && (
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={cancelEdit}
                    disabled={isLoading}
                  >
                    Bekor qilish
                  </button>
                )}
                <button
                  type="submit"
                  className={`add-btn ${editingStudent ? 'edit-mode' : ''}`}
                  disabled={isLoading || photoFaceStatus === 'checking'}
                >
                  {isLoading ? '⏳ Saqlanmoqda...' : editingStudent ? '💾 Saqlash' : '✅ O\'quvchini qo\'shish'}
                </button>
              </div>
            </form>

            {/* O'quvchilar ro'yxati */}
            <div className="students-list">
              <h3 className="list-title">👥 O'quvchilar ro'yxati</h3>

              {students.length === 0 ? (
                <div className="empty-list">
                  <span>📋</span>
                  <p>Hali o'quvchi qo'shilmagan</p>
                </div>
              ) : (
                students.map(student => {
                  const sId = student._id || student.id;
                  const curId = currentStudent ? String(currentStudent._id || currentStudent.id) : null;
                  const isSelected = curId === String(sId);
                  
                  return (
                    <div
                      key={String(sId)}
                      className={`student-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="student-card-left">
                        {student.photo ? (
                          <img src={student.photo} alt={student.firstName} className="student-photo" />
                        ) : (
                          <div className="student-avatar">👤</div>
                        )}
                        <div className="student-info">
                          <div className="student-name">{student.firstName} {student.lastName}</div>
                          <div className="student-date">
                            Qo'shilgan: {new Date(student.createdAt).toLocaleDateString('uz-UZ')}
                          </div>
                        </div>
                      </div>

                      <div className="student-card-actions">
                        <button
                          className={`select-btn ${isSelected ? 'active' : ''}`}
                          onClick={() => handleSelect(student)}
                          title="Kamerada tanish uchun tanlash"
                        >
                          {isSelected ? '📷 Tanlangan' : '📷 Tanlash'}
                        </button>
                        <button
                          className="lesson-btn"
                          onClick={() => handleStartLesson(student)}
                          title="Darsni boshlash"
                        >
                          ▶ Dars
                        </button>
                        <button
                          className="edit-icon-btn"
                          onClick={() => startEdit(student)}
                          title="Tahrirlash"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(student)}
                          title="O'chirish"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;
