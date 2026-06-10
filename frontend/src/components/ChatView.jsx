import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { v4 as uuidv4 } from 'uuid';
import './ChatView.css';

const API_URL = '/api/chat';

// Dars ma'lumotlari
const LESSON = {
  title: 'Quyosh Tizimi',
  icon:  '🌌',
  topic: 'Bugungi darsimiz: Quyosh tizimi',
  facts: [
    '☀️ Quyosh tizimi 4,6 milliard yil oldin vujudga kelgan',
    '🪐 Tizimda 8 ta sayyora mavjud',
    '🌍 Yer Quyoshdan 150 mln km uzoqlikda joylashgan',
    '💫 Quyosh tizimda 200+ dan ortiq oy mavjud',
  ],
  quickQuestions: [
    'Quyosh tizimida nechta sayyora bor?',
    'Eng katta sayyora qaysi?',
    'Yer quyoshdan qancha uzoqda?',
    'Quyosh nima?',
    'Mars sayyorasini aytib ber',
  ],
};

// Xabar turlari
const MSG_TYPE = { USER: 'user', AI: 'ai', SYSTEM: 'system' };

// Dastlabki salom xabari
const WELCOME_MESSAGE = {
  id:        'welcome',
  type:      MSG_TYPE.AI,
  text:      `Assalomu alaykum! 👋 Men Ziyo — sizning AI o'qituvchingizman!\n\nBugun biz "${LESSON.title}" mavzusini o'rganamiz. 🌌 Savollaringizni bemalol bering, Barakalla! 🎓`,
  timestamp: new Date(),
};

const ChatView = ({ isStudentPresent }) => {
  const [messages,    setMessages]    = useState([WELCOME_MESSAGE]);
  const [inputValue,  setInputValue]  = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [sessionId]                   = useState(() => uuidv4());
  const [isTyping,    setIsTyping]    = useState(false);
  const [showLesson,  setShowLesson]  = useState(true);
  const [charCount,   setCharCount]   = useState(0);

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const lastAiMsgRef     = useRef(null);
  const chatContainerRef = useRef(null);

  const MAX_CHARS = 300;

  // ── Xabarlar oxiriga o'tish ─────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── GSAP animatsiyasi - yangi AI xabari ─────────────────────────────────────
  useEffect(() => {
    if (lastAiMsgRef.current) {
      gsap.fromTo(
        lastAiMsgRef.current,
        { opacity: 0, y: 20, scale: 0.96 },
        {
          opacity:  1,
          y:        0,
          scale:    1,
          duration: 0.55,
          ease:     'back.out(1.4)',
        }
      );
    }
  }, [messages]);

  // ── O'quvchi yo'q bo'lganda xabar ───────────────────────────────────────────
  useEffect(() => {
    if (!isStudentPresent && messages.length > 1) {
      // Kamera tomonidan trigger bo'lganda
    }
  }, [isStudentPresent]);

  // ── Input o'zgarganda ────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setInputValue(val);
      setCharCount(val.length);
    }
  };

  // ── Xabar yuborish ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text = inputValue) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // O'quvchi yo'qligini tekshirish
    if (!isStudentPresent) {
      const warnMsg = {
        id:        uuidv4(),
        type:      MSG_TYPE.SYSTEM,
        text:      '📷 Kamera orqali o\'quvchi aniqlanmadi. Iltimos, kamera oldiga o\'tiring!',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, warnMsg]);
      return;
    }

    // Foydalanuvchi xabarini qo'shish
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
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:       trimmed,
          sessionId,
          lessonContext: LESSON.title,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server xatosi');
      }

      // Simulatsiya qilingan yozish effekti
      setIsTyping(false);

      const aiMsg = {
        id:        uuidv4(),
        type:      MSG_TYPE.AI,
        text:      data.response,
        timestamp: new Date(),
        isNew:     true,
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      setIsTyping(false);
      const errMsg = {
        id:        uuidv4(),
        type:      MSG_TYPE.SYSTEM,
        text:      `❌ Xato: ${err.message}. Server ishlaётganini tekshiring.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, isStudentPresent, sessionId]);

  // ── Enter tugmasi ────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Chat tarixini tozalash ───────────────────────────────────────────────────
  const clearChat = async () => {
    try {
      await fetch(`/api/chat/session/${sessionId}`, { method: 'DELETE' });
    } catch (_) {}
    setMessages([WELCOME_MESSAGE]);
  };

  // ── Vaqtni formatlash ────────────────────────────────────────────────────────
  const formatTime = (date) =>
    date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  // ── Tez savol bosish ─────────────────────────────────────────────────────────
  const handleQuickQuestion = (q) => {
    setInputValue(q);
    setCharCount(q.length);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-view">

      {/* ─── Dars kartasi ──────────────────────────────────────────────── */}
      <div className={`lesson-card ${showLesson ? 'expanded' : 'collapsed'}`}>
        <button
          className="lesson-toggle"
          onClick={() => setShowLesson(v => !v)}
          aria-expanded={showLesson}
        >
          <div className="lesson-toggle-left">
            <span className="lesson-icon">{LESSON.icon}</span>
            <div>
              <div className="lesson-label">BUGUNGI DARS</div>
              <div className="lesson-title">{LESSON.topic}</div>
            </div>
          </div>
          <span className={`toggle-arrow ${showLesson ? 'up' : ''}`}>›</span>
        </button>

        {showLesson && (
          <div className="lesson-body">
            <div className="lesson-facts">
              {LESSON.facts.map((fact, i) => (
                <div key={i} className="lesson-fact">
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Ziyo avatar va sarlavha ───────────────────────────────────── */}
      <div className="chat-header">
        <div className="ziyo-avatar">
          <div className="avatar-ring">
            <div className="avatar-inner">🤖</div>
          </div>
          <div className="avatar-status">
            <span className="pulse-dot green"></span>
          </div>
        </div>
        <div className="chat-header-info">
          <h2 className="ziyo-name text-gradient">Ziyo</h2>
          <p className="ziyo-desc">AI Virtual O'qituvchi • {isStudentPresent ? '🟢 Faol' : '⭕ Kutmoqda'}</p>
        </div>
        <button
          className="btn btn-ghost btn-sm clear-btn"
          onClick={clearChat}
          title="Chatni tozalash"
        >
          🗑️
        </button>
      </div>

      {/* ─── Xabarlar ro'yxati ─────────────────────────────────────────── */}
      <div className="messages-container" ref={chatContainerRef}>
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
                  {/* Matnni paragraf bilan ajratish */}
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>

              {msg.type === MSG_TYPE.USER && (
                <div className="msg-avatar user-avatar">👤</div>
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
                <span></span><span></span><span></span>
              </div>
              <span className="typing-label">Ziyo yozmoqda...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Tez savollar ─────────────────────────────────────────────── */}
      <div className="quick-questions">
        <div className="qq-scroll">
          {LESSON.quickQuestions.map((q, i) => (
            <button
              key={i}
              className="qq-btn"
              onClick={() => handleQuickQuestion(q)}
              disabled={isLoading}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Kirish maydoni ───────────────────────────────────────────── */}
      <div className="chat-input-area">
        {!isStudentPresent && (
          <div className="presence-warning">
            📷 Kamera oldiga o'ting — Ziyo sizni ko'rishi kerak!
          </div>
        )}

        <div className="input-row">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-textarea"
              placeholder={
                isStudentPresent
                  ? "Ziyo'ga savol bering... (Enter — yuborish)"
                  : "📷 Avval kamera oldiga o'ting..."
              }
              value={inputValue}
              onChange={handleInputChange}
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
              <div className="send-spinner"></div>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
