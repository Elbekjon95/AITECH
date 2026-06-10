import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { v4 as uuidv4 } from 'uuid';
import QuizModal from './QuizModal';
import './ChatView.css';

const API_CHAT  = '/api/chat';
const API_LESSON = '/api/lesson';
const API_TOPICS = '/api/topics';

// Xabar turlari
const MSG_TYPE = { USER: 'user', AI: 'ai', SYSTEM: 'system' };

// Default salom xabari
const makeWelcome = (studentName) => ({
  id:        'welcome',
  type:      MSG_TYPE.AI,
  text:      `Assalomu alaykum${studentName ? ", " + studentName : ""}! 👋 Men Ziyo — sizning AI algebra o'qituvchingizman!\n\nQuyidagi mavzulardan birini tanlang yoki savol bering. 7-sinf algebra bo'yicha har qanday savolingizga javob beraman! 🎓`,
  timestamp: new Date(),
});

// ─── Text-to-Speech yordamchi ─────────────────────────────────────────────────
const speak = (text, onEnd) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const clean = text.replace(/[🎓📚✅❌⭐🏆💯📐🔢➕½⚖️🔤🟰📈✖️🗺️👋🤖]/g, '').trim();
  const utt   = new SpeechSynthesisUtterance(clean);

  // O'zbek tili uchun eng mos ovoz
  const voices = window.speechSynthesis.getVoices();
  const uzVoice = voices.find(v => v.lang.startsWith('uz'))
    || voices.find(v => v.lang.startsWith('tr'))
    || voices.find(v => v.lang.startsWith('ru'))
    || voices[0];

  if (uzVoice) utt.voice = uzVoice;
  utt.lang  = uzVoice?.lang || 'uz-UZ';
  utt.rate  = 0.9;
  utt.pitch = 1;
  utt.volume = 1;
  if (onEnd) utt.onend = onEnd;
  window.speechSynthesis.speak(utt);
};

const ChatView = ({ isStudentPresent, currentStudent }) => {
  const [messages,     setMessages]     = useState([makeWelcome(currentStudent?.firstName)]);
  const [inputValue,   setInputValue]   = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [sessionId]                     = useState(() => uuidv4());
  const [isTyping,     setIsTyping]     = useState(false);
  const [topics,       setTopics]       = useState([]);
  const [activeTopic,  setActiveTopic]  = useState(null);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening,  setIsListening]  = useState(false);
  const [showQuiz,     setShowQuiz]     = useState(false);
  const [msgCount,     setMsgCount]     = useState(0); // Quiz trigger uchun
  const [charCount,    setCharCount]    = useState(0);
  const [showTopics,   setShowTopics]   = useState(true);

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const lastAiMsgRef     = useRef(null);
  const recognitionRef   = useRef(null);
  const MAX_CHARS        = 300;
  const QUIZ_AFTER_MSGS  = 8; // Necha xabardan keyin quiz taklif qilinadi

  // ── Mavzularni yuklash ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(API_TOPICS)
      .then(r => r.json())
      .then(d => { if (d.success) setTopics(d.topics); })
      .catch(() => {});
  }, []);

  // ── O'quvchi o'zgarganda salom xabarini yangilash ────────────────────────────
  useEffect(() => {
    setMessages([makeWelcome(currentStudent?.firstName)]);
    setActiveTopic(null);
    setMsgCount(0);
  }, [currentStudent?.id]);

  // ── Xabarlar oxiriga o'tish ───────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── GSAP animatsiyasi ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (lastAiMsgRef.current) {
      gsap.fromTo(lastAiMsgRef.current,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
      );
    }
  }, [messages]);

  // ── SpeechRecognition (mikrofon) ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'uz-UZ';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => setIsListening(false);

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setInputValue(transcript);
      setCharCount(transcript.length);
    };

    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Mavzu tanlash — dars boshlash ────────────────────────────────────────────
  const handleTopicSelect = useCallback(async (topic) => {
    setActiveTopic(topic);
    setShowTopics(false);
    setIsLoading(true);
    setIsTyping(true);
    setMsgCount(0);

    const sysMsg = {
      id:        uuidv4(),
      type:      MSG_TYPE.SYSTEM,
      text:      `📚 "${topic.title}" mavzusi boshlandi`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, sysMsg]);

    try {
      const res  = await fetch(API_LESSON, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          topic:       topic.title,
          studentName: currentStudent?.firstName,
          sessionId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setIsTyping(false);
      const aiMsg = {
        id:        uuidv4(),
        type:      MSG_TYPE.AI,
        text:      data.response,
        timestamp: new Date(),
        isNew:     true,
      };
      setMessages(prev => [...prev, aiMsg]);
      setMsgCount(1);

      if (voiceEnabled) {
        setIsSpeaking(true);
        speak(data.response, () => setIsSpeaking(false));
      }
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id:        uuidv4(),
        type:      MSG_TYPE.SYSTEM,
        text:      `❌ Darsni boshlab bo'lmadi: ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [currentStudent, sessionId, voiceEnabled]);

  // ── Xabar yuborish ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text = inputValue) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (!isStudentPresent) {
      setMessages(prev => [...prev, {
        id:        uuidv4(),
        type:      MSG_TYPE.SYSTEM,
        text:      '📷 Kamera orqali o\'quvchi aniqlanmadi. Iltimos, kamera oldiga o\'ting!',
        timestamp: new Date(),
      }]);
      return;
    }

    const userMsg = {
      id:        uuidv4(),
      type:      MSG_TYPE.USER,
      text:      trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setCharCount(0);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const res  = await fetch(API_CHAT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:     trimmed,
          sessionId,
          topic:       activeTopic?.title || '7-sinf algebra',
          studentName: currentStudent?.firstName,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Server xatosi');

      setIsTyping(false);
      const aiMsg = {
        id:        uuidv4(),
        type:      MSG_TYPE.AI,
        text:      data.response,
        timestamp: new Date(),
        isNew:     true,
      };
      setMessages(prev => [...prev, aiMsg]);

      const newCount = msgCount + 1;
      setMsgCount(newCount);

      if (voiceEnabled) {
        setIsSpeaking(true);
        speak(data.response, () => setIsSpeaking(false));
      }

      // Quiz taklif qilish (8 xabardan keyin)
      if (newCount >= QUIZ_AFTER_MSGS && activeTopic) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id:        uuidv4(),
            type:      MSG_TYPE.SYSTEM,
            text:      `🎯 Ajoyib! Dars yaxshi ketmoqda. "${activeTopic.title}" mavzusidan test topshirishni xohlaysizmi?`,
            timestamp: new Date(),
            showQuizBtn: true,
          }]);
        }, 1500);
        setMsgCount(0);
      }

    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id:        uuidv4(),
        type:      MSG_TYPE.SYSTEM,
        text:      `❌ Xato: ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, isStudentPresent, sessionId, activeTopic, currentStudent, msgCount, voiceEnabled]);

  // ── Enter tugmasi ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Chat tozalash ─────────────────────────────────────────────────────────────
  const clearChat = async () => {
    try { await fetch(`/api/chat/session/${sessionId}`, { method: 'DELETE' }); } catch (_) {}
    window.speechSynthesis?.cancel();
    setMessages([makeWelcome(currentStudent?.firstName)]);
    setActiveTopic(null);
    setShowTopics(true);
    setMsgCount(0);
  };

  const formatTime = (d) => d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-view">

      {/* ─── Ziyo avatar va sarlavha ─────────────────────────────────────── */}
      <div className="chat-header">
        <div className="ziyo-avatar">
          <div className="avatar-ring">
            <div className="avatar-inner">🤖</div>
          </div>
          <div className="avatar-status">
            <span className={`pulse-dot ${isSpeaking ? 'speaking' : 'green'}`} />
          </div>
        </div>
        <div className="chat-header-info">
          <h2 className="ziyo-name text-gradient">Ziyo</h2>
          <p className="ziyo-desc">
            AI Algebra O'qituvchi •{' '}
            {isSpeaking ? '🔊 Gapirmoqda' : isStudentPresent ? '🟢 Faol' : '⭕ Kutmoqda'}
            {activeTopic && <span className="active-topic-badge"> • {activeTopic.emoji} {activeTopic.title}</span>}
          </p>
        </div>
        <div className="header-actions">
          {/* Ovoz tugmasi */}
          <button
            className={`icon-btn ${voiceEnabled ? 'active' : ''}`}
            onClick={() => {
              if (voiceEnabled) window.speechSynthesis?.cancel();
              setVoiceEnabled(v => !v);
              setIsSpeaking(false);
            }}
            title={voiceEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          {/* Mavzularni ko'rsatish */}
          <button
            className="icon-btn"
            onClick={() => setShowTopics(v => !v)}
            title="Mavzular"
          >
            📚
          </button>
          {/* Test tugmasi */}
          {activeTopic && (
            <button
              className="icon-btn quiz-trigger"
              onClick={() => setShowQuiz(true)}
              title="Test topshirish"
            >
              📝
            </button>
          )}
          {/* Tozalash */}
          <button className="icon-btn" onClick={clearChat} title="Chatni tozalash">🗑️</button>
        </div>
      </div>

      {/* ─── Mavzular paneli ─────────────────────────────────────────────── */}
      {showTopics && (
        <div className="topics-panel">
          <div className="topics-title">📐 7-sinf Algebra mavzulari:</div>
          <div className="topics-grid">
            {topics.map(topic => (
              <button
                key={topic.id}
                className={`topic-btn ${activeTopic?.id === topic.id ? 'active' : ''}`}
                onClick={() => handleTopicSelect(topic)}
                disabled={isLoading}
              >
                <span className="topic-emoji">{topic.emoji}</span>
                <span className="topic-label">{topic.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── O'quvchi ma'lumoti ───────────────────────────────────────────── */}
      {currentStudent && (
        <div className="student-info-bar">
          {currentStudent.photo
            ? <img src={currentStudent.photo} alt="student" className="student-mini-photo" />
            : <span className="student-mini-avatar">👤</span>
          }
          <span className="student-mini-name">
            {currentStudent.firstName} {currentStudent.lastName}
          </span>
          <span className="student-mini-label">— dars olmoqda</span>
        </div>
      )}

      {/* ─── Xabarlar ro'yxati ───────────────────────────────────────────── */}
      <div className="messages-container">
        {messages.map((msg, index) => {
          const isLastAi = msg.type === MSG_TYPE.AI && index === messages.length - 1 && msg.isNew;
          return (
            <div
              key={msg.id}
              ref={isLastAi ? lastAiMsgRef : null}
              className={`message-wrapper ${msg.type}`}
            >
              {msg.type === MSG_TYPE.AI && (
                <div className="msg-avatar ai-avatar">🤖</div>
              )}

              <div className="message-bubble-group">
                <div className={`message-bubble ${msg.type}`}>
                  {msg.text.split('\n').map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                  {/* Quiz taklif tugmasi */}
                  {msg.showQuizBtn && (
                    <button
                      className="quiz-offer-btn"
                      onClick={() => setShowQuiz(true)}
                    >
                      📝 Testni boshlash
                    </button>
                  )}
                </div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>

              {msg.type === MSG_TYPE.USER && (
                <div className="msg-avatar user-avatar">
                  {currentStudent?.photo
                    ? <img src={currentStudent.photo} alt="u" className="user-photo-avatar" />
                    : '👤'
                  }
                </div>
              )}
            </div>
          );
        })}

        {/* Yozmoqda animatsiyasi */}
        {isTyping && (
          <div className="message-wrapper ai typing-wrapper">
            <div className="msg-avatar ai-avatar">🤖</div>
            <div className="message-bubble ai typing-bubble">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              <span className="typing-label">Ziyo yozmoqda...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Kirish maydoni ─────────────────────────────────────────────── */}
      <div className="chat-input-area">
        {!isStudentPresent && (
          <div className="presence-warning">
            📷 Kamera oldiga o'ting — Ziyo sizni ko'rishi kerak!
          </div>
        )}

        <div className="input-row">
          {/* Mikrofon tugmasi */}
          <button
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={isListening ? stopListening : startListening}
            title="Ovozli xabar"
          >
            {isListening ? '🔴' : '🎤'}
          </button>

          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-textarea"
              placeholder={
                isStudentPresent
                  ? activeTopic
                    ? `"${activeTopic.title}" bo'yicha savol bering...`
                    : "Mavzu tanlang yoki savol bering..."
                  : "📷 Avval kamera oldiga o'ting..."
              }
              value={inputValue}
              onChange={e => {
                if (e.target.value.length <= MAX_CHARS) {
                  setInputValue(e.target.value);
                  setCharCount(e.target.value.length);
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <div className="char-counter" style={{
              color: charCount > MAX_CHARS * 0.85 ? '#f59e0b' : 'var(--clr-text-muted)'
            }}>
              {charCount}/{MAX_CHARS}
            </div>
          </div>

          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            aria-label="Yuborish"
          >
            {isLoading ? (
              <div className="send-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ─── Quiz modali ─────────────────────────────────────────────────── */}
      {showQuiz && activeTopic && (
        <QuizModal
          topic={activeTopic.title}
          studentName={currentStudent?.firstName}
          onClose={() => setShowQuiz(false)}
          onComplete={(score, total) => {
            setShowQuiz(false);
            setMessages(prev => [...prev, {
              id:        uuidv4(),
              type:      MSG_TYPE.SYSTEM,
              text:      `🏆 Test natijasi: ${score}/${total} (${Math.round(score/total*100)}%). ${score >= total*0.7 ? "Barakalla! Zo'r natija! 🎉" : "Keyingi safar yaxshiroq bo'ladi! 💪"}`,
              timestamp: new Date(),
            }]);
          }}
        />
      )}
    </div>
  );
};

export default ChatView;
