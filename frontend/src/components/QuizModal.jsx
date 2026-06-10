import React, { useState, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import './QuizModal.css';

const QuizModal = ({ topic, studentName, onClose, onComplete }) => {
  const [quiz,        setQuiz]        = useState(null);
  const [current,     setCurrent]     = useState(0);
  const [selected,    setSelected]    = useState(null);
  const [answers,     setAnswers]     = useState([]);
  const [showResult,  setShowResult]  = useState(false);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState('');
  const [confirmed,   setConfirmed]   = useState(false);
  const [score,       setScore]       = useState(0);

  // ── Quiz yuklash ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setIsLoading(true);
        const res  = await fetch('/api/quiz', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ topic, studentName }),
        });
        const data = await res.json();
        if (data.success && data.quiz?.questions?.length > 0) {
          setQuiz(data.quiz);
        } else {
          setError('Test yuklab bo\'lmadi: ' + (data.error || 'Noma\'lum xato'));
        }
      } catch (err) {
        setError('Server bilan aloqa yo\'q. Qaytadan urinib ko\'ring.');
      } finally {
        setIsLoading(false);
      }
    };
    loadQuiz();
  }, [topic, studentName]);

  // ── Javob tanlash ────────────────────────────────────────────────────────────
  const handleSelect = (option) => {
    if (confirmed) return;
    setSelected(option);
  };

  // ── Javobni tasdiqlash ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selected || confirmed) return;
    const question = quiz.questions[current];
    const isCorrect = selected === question.correct;
    setConfirmed(true);
    setAnswers(prev => [...prev, { question: question.question, selected, correct: question.correct, isCorrect }]);
    if (isCorrect) setScore(prev => prev + 1);
  }, [selected, confirmed, quiz, current]);

  // ── Keyingi savol ────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (current < quiz.questions.length - 1) {
      setCurrent(prev => prev + 1);
      setSelected(null);
      setConfirmed(false);
      gsap.fromTo('.quiz-question-card',
        { opacity: 0, x: 40 },
        { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }
      );
    } else {
      setShowResult(true);
    }
  };

  // ── Natija ballari ───────────────────────────────────────────────────────────
  const getGrade = (correct, total) => {
    const pct = (correct / total) * 100;
    if (pct >= 90) return { emoji: '🏆', label: 'Ajoyib!',   color: '#10b981' };
    if (pct >= 70) return { emoji: '⭐', label: 'Yaxshi!',   color: '#3b82f6' };
    if (pct >= 50) return { emoji: '📚', label: 'Qoniqarli', color: '#f59e0b' };
    return           { emoji: '💪', label: 'Harakat qil!', color: '#f43f5e' };
  };

  const totalQ = quiz?.questions?.length || 5;
  const grade  = getGrade(score, totalQ);
  const pct    = Math.round((score / totalQ) * 100);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="quiz-overlay">
      <div className="quiz-modal">
        <div className="quiz-loading">
          <div className="quiz-spinner" />
          <p>Ziyo test tayyarlamoqda...</p>
          <span>"{topic}" mavzusidan 5 ta savol</span>
        </div>
      </div>
    </div>
  );

  // ── Xato ────────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="quiz-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quiz-modal">
        <div className="quiz-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button className="quiz-btn-primary" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );

  // ── Natija ──────────────────────────────────────────────────────────────────
  if (showResult) return (
    <div className="quiz-overlay">
      <div className="quiz-modal result-modal">
        <div className="result-header">
          <div className="result-emoji">{grade.emoji}</div>
          <h2 className="result-title" style={{ color: grade.color }}>{grade.label}</h2>
          {studentName && <p className="result-student">{studentName}!</p>}
        </div>

        <div className="result-score-circle" style={{ '--score-color': grade.color }}>
          <div className="score-inner">
            <span className="score-num">{score}/{totalQ}</span>
            <span className="score-pct">{pct}%</span>
          </div>
        </div>

        <div className="result-answers">
          {answers.map((a, i) => (
            <div key={i} className={`result-item ${a.isCorrect ? 'correct' : 'wrong'}`}>
              <span className="result-item-icon">{a.isCorrect ? '✅' : '❌'}</span>
              <div className="result-item-text">
                <div className="result-q">{i + 1}. {a.question}</div>
                {!a.isCorrect && (
                  <div className="result-correct-ans">✔ To'g'ri: {a.correct}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="result-actions">
          <button className="quiz-btn-primary" onClick={() => onComplete(score, totalQ)}>
            🎓 Darsga qaytish
          </button>
          <button className="quiz-btn-ghost" onClick={onClose}>
            Yopish
          </button>
        </div>
      </div>
    </div>
  );

  // ── Savol ────────────────────────────────────────────────────────────────────
  if (!quiz) return null;
  const question = quiz.questions[current];
  const progress = ((current + 1) / totalQ) * 100;

  return (
    <div className="quiz-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quiz-modal">

        {/* Header */}
        <div className="quiz-header">
          <div className="quiz-topic">
            <span>📐</span>
            <span>{topic}</span>
          </div>
          <button className="quiz-close" onClick={onClose}>✕</button>
        </div>

        {/* Progress */}
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-progress-label">
          Savol {current + 1} / {totalQ}
        </div>

        {/* Savol kartasi */}
        <div className="quiz-question-card">
          <p className="quiz-question-text">{question.question}</p>

          <div className="quiz-options">
            {Object.entries(question.options).map(([key, value]) => {
              let cls = 'quiz-option';
              if (selected === key) cls += ' selected';
              if (confirmed) {
                if (key === question.correct) cls += ' correct';
                else if (key === selected)    cls += ' wrong';
              }
              return (
                <button
                  key={key}
                  className={cls}
                  onClick={() => handleSelect(key)}
                  disabled={confirmed}
                >
                  <span className="option-key">{key}</span>
                  <span className="option-val">{value}</span>
                </button>
              );
            })}
          </div>

          {/* Izoh (tasdiqlangandan keyin) */}
          {confirmed && (
            <div className={`quiz-explanation ${selected === question.correct ? 'correct' : 'wrong'}`}>
              <span>{selected === question.correct ? '✅' : '❌'}</span>
              <span>{question.explanation}</span>
            </div>
          )}
        </div>

        {/* Amallar */}
        <div className="quiz-actions">
          {!confirmed ? (
            <button
              className="quiz-btn-primary"
              onClick={handleConfirm}
              disabled={!selected}
            >
              ✔ Tasdiqlash
            </button>
          ) : (
            <button className="quiz-btn-primary" onClick={handleNext}>
              {current < totalQ - 1 ? 'Keyingi savol →' : '🏁 Natijani ko\'rish'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default QuizModal;
