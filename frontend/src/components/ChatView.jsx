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

  // Karaoke/Highlighting statelari
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const lastAiMsgRef     = useRef(null);
  const recognitionRef   = useRef(null);
  
  // Gemini TTS Preload Oqimi Refs
  const audioRef         = useRef(null);
  const audioCache       = useRef({}); // index -> base64 audioUrl
  const currentPlayingIdx = useRef(0);
  const isPlayingQueue   = useRef(false);

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
    stopSpeakingFlow();
    
    setMessages([makeWelcome(currentStudent?.firstName)]);
    setActiveTopic(null);
    setMsgCount(0);
  }, [currentStudent?._id, currentStudent?.id]);

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

  // ── Ovoz ijrosini butunlay to'xtatish ─────────────────────────────────────────
  const stopSpeakingFlow = () => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioCache.current = {};
    currentPlayingIdx.current = 0;
    isPlayingQueue.current = false;
    setSpeakingMsgId(null);
    setCurrentWordIdx(-1);
    setIsSpeaking(false);
  };

  // ── Web Speech API Fallback (Gapma-gap fallback) ─────────────────────────────
  const speakFallbackSentence = useCallback((msgId, cleanText, range, onSentenceEnd) => {
    if (!('speechSynthesis' in window)) {
      onSentenceEnd();
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const uzVoice = voices.find(v => v.lang.startsWith('uz'))
      || voices.find(v => v.lang.startsWith('tr'))
      || voices.find(v => v.lang.startsWith('ru'))
      || voices[0];

    if (uzVoice) utterance.voice = uzVoice;
    utterance.lang  = uzVoice?.lang || 'uz-UZ';
    utterance.rate  = 1.05;

    const sentenceWords = range.words;
    const wordBoundaries = [];
    let currentPos = 0;
    sentenceWords.forEach((word) => {
      const startIdx = cleanText.indexOf(word, currentPos);
      if (startIdx !== -1) {
        wordBoundaries.push({ word, startIdx, endIdx: startIdx + word.length });
        currentPos = startIdx + word.length;
      }
    });

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const foundWordIdx = wordBoundaries.findIndex(
          wb => charIndex >= wb.startIdx && charIndex <= wb.endIdx
        );
        if (foundWordIdx !== -1) {
          const globalIdx = range.startIdx + foundWordIdx;
          setCurrentWordIdx(globalIdx);
          const wordEl = document.getElementById(`word-${msgId}-${globalIdx}`);
          if (wordEl) wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    utterance.onend = () => {
      onSentenceEnd();
    };

    utterance.onerror = () => {
      onSentenceEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Orqa fonda gaplarni yuklash (Preload) ─────────────────────────────────────
  const preloadSentence = async (idx, sentences) => {
    if (idx >= sentences.length) return;
    if (audioCache.current[idx]) return; // allaqachon yuklangan

    try {
      const text = sentences[idx];
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success) {
        audioCache.current[idx] = `data:${data.mimeType};base64,${data.audioData}`;
        console.log(`[TTS Preload] Gap ${idx} yuklandi.`);
      }
    } catch (_) {}
  };

  // ── Gaplar Oqimini Ijro etish (Play Queue) ────────────────────────────────────
  const playQueue = useCallback(async (msgId, sentences, sentenceWordRanges, onEnd) => {
    const idx = currentPlayingIdx.current;
    
    if (idx >= sentences.length) {
      // Dars to'liq tugadi
      setSpeakingMsgId(null);
      setCurrentWordIdx(-1);
      isPlayingQueue.current = false;
      setIsSpeaking(false);
      onEnd?.();
      setTimeout(scrollToBottom, 300);
      return;
    }

    setIsSpeaking(true);
    isPlayingQueue.current = true;

    // Keshda bormi tekshiramiz, bo'lmasa yuklashni kutamiz
    let audioUrl = audioCache.current[idx];
    if (!audioUrl) {
      console.log(`[TTS] Gap ${idx} keshda yo'q, yuklash kutilmoqda...`);
      await preloadSentence(idx, sentences);
      audioUrl = audioCache.current[idx];
    }

    // Fallback: yuklanmasa, tizim ovozi bilan o'qiydi
    if (!audioUrl) {
      console.warn(`[TTS] Gap ${idx} yuklash xatosi, fallback ishga tushdi.`);
      speakFallbackSentence(msgId, sentences[idx], sentenceWordRanges[idx], () => {
        currentPlayingIdx.current++;
        playQueue(msgId, sentences, sentenceWordRanges, onEnd);
      });
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      const range = sentenceWordRanges[idx];
      const sentenceWords = range.words;
      const totalChars = sentenceWords.reduce((acc, w) => acc + w.length, 0);
      let currentOffset = 0;

      const wordTimes = sentenceWords.map(word => {
        const wordDuration = (word.length / totalChars) * duration;
        const start = currentOffset;
        const end = start + wordDuration;
        currentOffset = end;
        return { start, end };
      });

      audio.ontimeupdate = () => {
        const curTime = audio.currentTime;
        const activeLocalIdx = wordTimes.findIndex(wt => curTime >= wt.start && curTime <= wt.end);
        if (activeLocalIdx !== -1) {
          const globalIdx = range.startIdx + activeLocalIdx;
          setCurrentWordIdx(globalIdx);
          const wordEl = document.getElementById(`word-${msgId}-${globalIdx}`);
          if (wordEl) {
            wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      };
    };

    audio.onended = () => {
      audioRef.current = null;
      currentPlayingIdx.current++;
      playQueue(msgId, sentences, sentenceWordRanges, onEnd);
    };

    audio.onerror = () => {
      audioRef.current = null;
      currentPlayingIdx.current++;
      playQueue(msgId, sentences, sentenceWordRanges, onEnd);
    };

    // Ijro etish va keyingi gaplarni fonda preload qilish
    await audio.play();
    preloadSentence(idx + 1, sentences);
    preloadSentence(idx + 2, sentences);
  }, [scrollToBottom, speakFallbackSentence]);

  // ── Text-to-Speech (TTS) kirish nuqtasi ──────────────────────────────────────
  const speak = useCallback(async (msgId, text, onEnd) => {
    stopSpeakingFlow();

    setSpeakingMsgId(msgId);
    setCurrentWordIdx(-1);

    // Emoji tozalash
    const EMOJI_REG = /[🎓📚✅❌⭐🏆💯📐🔢➕½⚖️🔤🟰📈✖️🗺️👋🤖]/g;
    const clean = text.replace(EMOJI_REG, '').trim();

    // Gaplarni aniqlash (. ! ? yoki yangi qator bo'yicha)
    const rawParts = clean.split(/(?<=[.!?])\s+|\n+/);
    const sentences = rawParts.map(p => p.trim()).filter(p => p.length > 0);

    if (sentences.length === 0) {
      onEnd?.();
      return;
    }

    // Har bir gap uchun so'z diapazonini (word ranges) tuzish
    let globalWordOffset = 0;
    const sentenceWordRanges = sentences.map(sentence => {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);
      const startIdx = globalWordOffset;
      const endIdx = startIdx + sentenceWords.length;
      globalWordOffset = endIdx;
      return { words: sentenceWords, startIdx, endIdx };
    });

    console.log(`[TTS] Dars ${sentences.length} ta gapga bo'lindi. Yuklash boshlandi...`);
    
    // Birinchi gapni tez yuklash
    await preloadSentence(0, sentences);

    // Ikkinchi gapni fonda yuklashni boshlash
    preloadSentence(1, sentences);

    // Playback boshlash
    currentPlayingIdx.current = 0;
    playQueue(msgId, sentences, sentenceWordRanges, onEnd);

  }, [playQueue]);

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
    stopSpeakingFlow();

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
        speak(aiMsg.id, data.response, () => setIsSpeaking(false));
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
  }, [currentStudent, sessionId, voiceEnabled, speak]);

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

    stopSpeakingFlow();

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
        speak(aiMsg.id, data.response, () => setIsSpeaking(false));
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
  }, [inputValue, isLoading, isStudentPresent, sessionId, activeTopic, currentStudent, msgCount, voiceEnabled, speak]);

  // ── Enter tugmasi ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Chat tozalash ─────────────────────────────────────────────────────────────
  const clearChat = async () => {
    try { await fetch(`/api/chat/session/${sessionId}`, { method: 'DELETE' }); } catch (_) {}
    stopSpeakingFlow();
    setMessages([makeWelcome(currentStudent?.firstName)]);
    setActiveTopic(null);
    setShowTopics(true);
    setMsgCount(0);
  };

  // ── Karaoke Matn Rendereri (So'zma-so'z va gapiruvchi animatsiyasi bilan) ───────
  const renderMessageText = (msg) => {
    if (msg.type !== MSG_TYPE.AI) {
      return msg.text.split('\n').map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ));
    }

    const EMOJI_REG = /[🎓📚✅❌⭐🏆💯📐🔢➕½⚖️🔤🟰📈✖️🗺️👋🤖]/g;
    const lines = msg.text.split('\n');
    let wordGlobalCounter = 0;

    return lines.map((line, lineIdx) => {
      if (!line.trim()) return <React.Fragment key={lineIdx}><br /></React.Fragment>;

      const lineWords = line.split(/(\s+)/);

      return (
        <div key={lineIdx} className="message-line" style={{ display: 'inline' }}>
          {lineWords.map((part, partIdx) => {
            if (/^\s+$/.test(part)) return part;

            const cleanWord = part.replace(EMOJI_REG, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '').trim();

            let currentCounter = null;
            if (cleanWord.length > 0) {
              currentCounter = wordGlobalCounter;
              wordGlobalCounter++;
            }

            const isWordActive = speakingMsgId === msg.id && currentCounter !== null && currentWordIdx === currentCounter;
            const isWordRead = speakingMsgId === msg.id && currentCounter !== null && currentCounter < currentWordIdx;

            let cleanPart = part;
            let isBold = false;
            if (part.startsWith('**') && part.endsWith('**')) {
              cleanPart = part.slice(2, -2);
              isBold = true;
            }

            return (
              <span
                key={partIdx}
                id={currentCounter !== null ? `word-${msg.id}-${currentCounter}` : undefined}
                className={`word-span ${isWordActive ? 'active-word' : ''} ${isWordRead ? 'read-word' : ''}`}
                style={{
                  fontWeight: isBold ? 'bold' : 'normal',
                }}
              >
                {cleanPart}
              </span>
            );
          })}
          {lineIdx < lines.length - 1 && <br />}
        </div>
      );
    });
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
              if (voiceEnabled) {
                stopSpeakingFlow();
              }
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
            {topics.map(topic => {
              const topicId = topic._id || topic.topicId || topic.id;
              const activeId = activeTopic?._id || activeTopic?.topicId || activeTopic?.id;
              const isActive = activeId && topicId && String(activeId) === String(topicId);
              
              return (
                <button
                  key={String(topicId)}
                  className={`topic-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleTopicSelect(topic)}
                  disabled={isLoading}
                >
                  <span className="topic-emoji">{topic.emoji}</span>
                  <span className="topic-label">{topic.title}</span>
                </button>
              );
            })}
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
          const isSpeakingMode = speakingMsgId === msg.id && voiceEnabled;
          
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
                <div className={`message-bubble ${msg.type} ${isSpeakingMode ? 'speaking-mode' : ''}`}>
                  {renderMessageText(msg)}
                  
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
