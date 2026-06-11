import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  // "Tanildi" animatsiyasi uchun
  const [justRecognized, setJustRecognized] = useState(false);
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
  // Yuz aniqlanganda va currentStudent tanlangan bo'lsa — "tanildi" deb belgilash
  const handlePresenceChange = useCallback((present) => {
    setFaceDetected(present);
    onStudentPresenceChange?.(present);

    if (present && currentStudent) {
      // "Tanildi" animatsiyasini ko'rsatish
      setJustRecognized(true);
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = setTimeout(() => setJustRecognized(false), 3000);
    }
  }, [currentStudent, onStudentPresenceChange]);

  // Avtomatik yuz mosligi aniqlanganda chaqiriladi
  const handleStudentRecognized = useCallback((recognizedStudent) => {
    if (currentStudent?.id === recognizedStudent.id) return;
    
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

  // ── Rasm tanlash ─────────────────────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Rasm hajmi 2MB dan oshmasligi kerak.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target.result);
      setPhotoBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── O'quvchi qo'shish ────────────────────────────────────────────────────────
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Ism va familiya kiritilishi shart!");
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/students', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          photo:     photoBase64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudents(prev => [...prev, data.student]);
        setFirstName('');
        setLastName('');
        setPhotoPreview(null);
        setPhotoBase64(null);
        if (fileRef.current) fileRef.current.value = '';
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

  // ── O'quvchi o'chirish ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      setStudents(prev => prev.filter(s => s.id !== id));
      if (currentStudent?.id === id) onStudentSelect(null);
    } catch (_) {}
  };

  // ── O'quvchi tanlash (panel yopilmaydi, kamerada ko'rinish uchun) ─────────────
  const handleSelect = (student) => {
    onStudentSelect(student);
    // Camera tabga o'tib kamerada ko'rsatish
    setTab('camera');
  };

  // ── O'quvchi bilan darsni boshlash (panel yopiladi) ──────────────────────────
  const handleStartLesson = (student) => {
    onStudentSelect(student);
    onClose();
  };

  return (
    <div className="admin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-panel">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="admin-header">
          <div className="admin-title">
            <span className="admin-icon">⚙️</span>
            <div>
              <h2>Admin Panel</h2>
              <p>Tizim boshqaruvi</p>
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
            📷 Kamera
          </button>
          <button
            className={`admin-tab ${tab === 'students' ? 'active' : ''}`}
            onClick={() => setTab('students')}
          >
            👥 O'quvchilar ({students.length})
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
                    {/* Kamera holati indikatori */}
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
                    <strong>O'quvchilar</strong> tabida o'quvchi tanlang — tizim uni kamerada taniydi
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Tab: O'quvchilar ────────────────────────────────────────────── */}
        {tab === 'students' && (
          <div className="admin-students-section">

            {/* O'quvchi qo'shish formasi */}
            <form className="add-student-form" onSubmit={handleAddStudent}>
              <h3 className="form-title">➕ Yangi o'quvchi qo'shish</h3>

              {/* Rasm yuklash */}
              <div className="photo-upload-area" onClick={() => fileRef.current?.click()}>
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="photo-preview" />
                ) : (
                  <div className="photo-placeholder">
                    <span>📷</span>
                    <span>Rasm yuklash</span>
                    <span className="photo-hint">PNG, JPG • Maks 2MB</span>
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

              <button type="submit" className="add-btn" disabled={isLoading}>
                {isLoading ? '⏳ Qo\'shilmoqda...' : '✅ O\'quvchini qo\'shish'}
              </button>
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
                students.map(student => (
                  <div
                    key={student.id}
                    className={`student-card ${currentStudent?.id === student.id ? 'selected' : ''}`}
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
                          {new Date(student.createdAt).toLocaleDateString('uz-UZ')}
                        </div>
                      </div>
                    </div>

                    <div className="student-card-actions">
                      {/* Kamerada ko'rsatish */}
                      <button
                        className={`select-btn ${currentStudent?.id === student.id ? 'active' : ''}`}
                        onClick={() => handleSelect(student)}
                        title="Kamerada tanish uchun tanlash"
                      >
                        {currentStudent?.id === student.id ? '📷 Kamerada' : '📷 Tanlash'}
                      </button>
                      {/* Darsni to'g'ridan boshlash */}
                      <button
                        className="lesson-btn"
                        onClick={() => handleStartLesson(student)}
                        title="Darsni boshlash"
                      >
                        ▶ Dars
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(student.id)}
                        title="O'chirish"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;
