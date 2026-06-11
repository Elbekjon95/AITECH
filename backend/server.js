require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Modellar importi
const Student = require("./models/Student");
const Topic = require("./models/Topic");
const ChatSession = require("./models/ChatSession");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "10mb" }));

// ─── MongoDB Ulanishi ──────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ziyo_ai_school")
  .then(() => console.log("MongoDB ga ulanish muvaffaqiyatli! 🍃"))
  .catch(err => console.error("MongoDB ulanish xatosi:", err));

// ─── Gemini AI Setup ──────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash";

const getModel = (systemInstruction, maxTokens = 512) => {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    },
  });
};

// ─── WAV Header qo'shish funksiyasi (Raw PCM ni WAV ga o'tkazish) ─────────────
function addWavHeader(pcmBase64, sampleRate = 24000) {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]).toString('base64');
}

// ─── Ziyo o'qituvchi system prompti ──────────────────────────────────────────
const buildLessonPrompt = (studentName, topicTitle, topicData) => `
Sen 7-sinf algebra o'qituvchisi "Ziyo"san.
O'quvchi ismi: ${studentName || "o'quvchi"}.
Faqat O'ZBEK TILIDA (lotin alifbosi) javob ber.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DARSLIK MATERIALI: "${topicTitle}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TA'RIF:
${topicData.definition}

QOIDALAR:
${topicData.rules.map((r, i) => `${i + 1}) ${r}`).join('\n')}

MISOLLAR (qadam-qadam):
${topicData.examples.map((ex, i) =>
  `[Misol ${i + 1}] ${ex.step}\n  ${ex.expression}\n  → ${ex.explanation}`
).join('\n\n')}

YAKUNIY MASHQ:
Savol: ${topicData.exercise.question}
Javob: ${topicData.exercise.correctAnswer}
Maslahat: ${topicData.exercise.hint}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QATIY QOIDALAR:

▸ KIRISH YO'Q — "Salom, bugun biz...", "Tayyormisan?", "Qiziqarli mavzu..." kabi KIRISH GAPLARI YOZMA!
  Dars DARHOL ta'rifdan va birinchi misoldan boshlansin.

▸ JAVOBNI YARIMTA QOLDIRMA — Dars va tushuntirishlarni hech qachon o'rtasida uzib qo'yma. Har bir gap va bo'lim to'liq yakunlansin. Token limiti doirasida darsni to'liq tugat.

▸ DARS TO'LIQ BO'LSIN — Dars boshlanganda yuqorida berilgan darslikdagi barcha ta'rif, qoidalar va misollarni ketma-ket batafsil va qadam-qadam tushuntirib ber. Biron bir misol yoki qoidani tashlab ketma.

▸ MATEMATIKA MAZMUNI KO'P BO'LSIN:
  - Ta'rifni bir gapda berma — uni kengaytir, nima uchunligini tushuntir.
  - Har bir QOIDANI yozgandan keyin darhol darslikdagi MISOLNI yech:
      1-qadam: [aniq harakat va sababi]
      2-qadam: [aniq harakat va sababi]
      3-qadam: ...
      Natija: [yakuniy javob] ✓
  - Misolda har bir SON va ISHORA o'zgarishini tushuntir.
    ("Manfiy × manfiy = musbat, chunki...", "Maxrajlar tenglashtiriladi, chunki...")
  - Har bir misoldan keyin xuddi shu qoida bo'yicha qo'shimcha tushuntirish ber.

▸ XATO QILMA — faqat DARSLIK MATERIALIDAGI misollarni ishlat, o'ylab chiqarma.

▸ MASHQ — Barcha qoidalar va misollar tugagandan keyin YAKUNIY MASHQNI ber.
  O'quvchi javob bersa: to'g'ri → "Barakalla! [nima to'g'ri qilganini 1 gapda ayt]"
                        xato   → "[nima xato], [to'g'ri yo'nalish] — qaytadan urining."

▸ O'quvchi "ha", "tushunarli", "davom et" desa — TO'XTAMA, keyingi qoida/misol/mavzuga o't.
▸ Savol bersa — darslik materialiga asoslanib aniq va batafsil javob ber.
`;



const buildQuizPrompt = (topicData, studentName) => `
Sen 7-sinf algebra o'qituvchisisisan. Quyidagi darslik mavzusi materiallari asosida 5 ta test savoli yarat.
---
DARSLIK MATERIALI:
Mavzu: "${topicData.title}"
Ta'rif: ${topicData.definition}
Qoidalar: ${topicData.rules.join('\n')}
---

Qoidalar:
- O'zbek tilida (lotin alifbosi) yozilsin.
- Har bir savolda A, B, C, D javob variantlari bo'lsin.
- Faqat bitta to'g'ri javob bo'lsin.
- Savollar aynan yuqoridagi darslik mavzusi va qoidalari asosida bo'lsin.
- ${studentName || "o'quvchi"} uchun mos qiyinlikda bo'lsin.
- Javob variantlarida FAQAT oddiy matn ishlat, hech qanday matematik belgi yoki maxsus belgi ishlatma.
- Har bir javob varianti 1-2 ta oddiy so'zdan iborat qisqa matn bo'lsin.

MUHIM: Faqat quyidagi ANIQ JSON formatida javob ber, boshqa hech narsa yozma:
{
  "questions": [
    {
      "id": 1,
      "question": "savol matni",
      "options": { "A": "birinchi variant", "B": "ikkinchi variant", "C": "uchinchi variant", "D": "to'rtinchi variant" },
      "correct": "A",
      "explanation": "qisqa izoh"
    }
  ]
}
`;

// ─── POST /api/students — o'quvchi qo'shish ──────────────────────────────────
app.post("/api/students", async (req, res) => {
  try {
    const { firstName, lastName, photo } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: "Ism va familiya kiritilishi shart." });
    }
    const student = new Student({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      photo:     photo || null,
    });
    await student.save();
    console.log(`[Students] Yangi o'quvchi saqlandi: ${student.firstName} ${student.lastName}`);
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/students — o'quvchilar ro'yxati ─────────────────────────────────
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/students/:id — o'quvchi tahrirlash ──────────────────────────────
app.put("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, photo } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: "Ism va familiya kiritilishi shart." });
    }
    const student = await Student.findByIdAndUpdate(
      id,
      {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        photo:     photo || null,
      },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ success: false, error: "O'quvchi topilmadi." });
    }
    console.log(`[Students] O'quvchi tahrirlandi: ${student.firstName} ${student.lastName}`);
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/students/:id ─────────────────────────────────────────────────
app.delete("/api/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Student.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/topics — algebra mavzulari ─────────────────────────────────────
app.get("/api/topics", async (req, res) => {
  try {
    const topics = await Topic.find().sort({ topicId: 1 });
    res.json({ success: true, topics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/lesson — dars boshlash ────────────────────────────────────────
app.post("/api/lesson", async (req, res) => {
  try {
    const { topic, studentName, sessionId } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: "Mavzu kiritilmadi." });

    // Bazadan mavzu ma'lumotlarini olish
    const topicData = await Topic.findOne({ title: topic });
    if (!topicData) {
      return res.status(404).json({ success: false, error: "Darslik mavzusi topilmadi." });
    }

    const sid = sessionId || "default";
    // Yangi dars uchun sessiya tarixini o'chirish
    await ChatSession.deleteOne({ sessionId: sid });

    const systemPrompt = buildLessonPrompt(studentName, topic, topicData);
    // Dars uchun ko'proq token (lotin alifbosidagi o'zbek tili uchun 3000 ta token yetarli)
    const model = getModel(systemPrompt, 3000);

    const chat = model.startChat({ history: [] });

    // Aniq dars so'rovi
    const lessonRequest = `"${topic}" mavzusini batafsil tushuntirib dars ber. Quyidagi barcha qismlarni darslik materialiga asoslanib to'liq yoz:
1) Mavzuning batafsil ta'rifi va tushuntirishi.
2) Darslikdagi barcha qoidalar.
3) Darslikdagi barcha misollar va ularning qadam-qadam yechilishlari.
4) Dars oxirida o'quvchi (${studentName || "o'quvchi"}) uchun bitta yakuniy mashq (savol).
Muhim: Gaplarni va tushuntirishlarni aslo yarimta qoldirma!`;

    const result = await chat.sendMessage(lessonRequest);
    const responseText = result.response.text();

    // Sessiyani bazada saqlash
    const newSession = new ChatSession({
      sessionId: sid,
      history: [
        { role: "user",  parts: [{ text: lessonRequest }] },
        { role: "model", parts: [{ text: responseText }] }
      ]
    });
    await newSession.save();

    console.log(`[Lesson] Mavzu: "${topic}" | O'quvchi: ${studentName || "?"} | Javob uzunligi: ${responseText.length}`);
    res.json({ success: true, response: responseText, sessionId: sid });
  } catch (err) {
    console.error("Lesson API xatosi:", err.message);
    res.status(500).json({ success: false, error: "Darsni boshlab bo'lmadi: " + err.message });
  }
});

// ─── POST /api/chat ───────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId, topic, studentName } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "Xabar bo'sh bo'lmasligi kerak." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "Gemini API kaliti topilmadi." });
    }

    // Bazadan mavzu ma'lumotlarini olish
    const topicData = await Topic.findOne({ title: topic });
    if (!topicData) {
      return res.status(404).json({ success: false, error: "Darslik mavzusi topilmadi." });
    }

    const sid = sessionId || "default";
    let session = await ChatSession.findOne({ sessionId: sid });
    
    if (!session) {
      session = new ChatSession({ sessionId: sid, history: [] });
    }

    const systemPrompt = buildLessonPrompt(studentName, topic || "7-sinf algebra", topicData);
    // Dars davomidagi chatda javoblar kesilmasligi uchun token hajmini 2000 ga oshiramiz
    const model = getModel(systemPrompt, 2000);
    
    // Gemini chatini sessiya tarixi bilan boshlash
    const chat = model.startChat({ history: session.history });

    const result = await chat.sendMessage(message.trim());
    const responseText = result.response.text();

    session.history.push(
      { role: "user",  parts: [{ text: message.trim() }] },
      { role: "model", parts: [{ text: responseText }] }
    );
    
    if (session.history.length > 24) {
      session.history = session.history.slice(-24);
    }
    session.updatedAt = new Date();
    await session.save();

    console.log(`[Chat] ${sid} | ${studentName || "?"}: "${message.slice(0,40)}" | Ziyo: "${responseText.slice(0,60)}..."`);

    res.json({ success: true, response: responseText, sessionId: sid });
  } catch (err) {
    console.error("Chat API xatosi:", err.message);
    const status = err.message?.includes("API_KEY_INVALID") ? 401
                 : err.message?.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// ─── POST /api/tts — Text-to-Speech (Gemini TTS) ──────────────────────────────
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: "Matn kiritilmadi." });
    }

    // gemini-2.5-flash-preview-tts modeli faqat audio modalitiesini qabul qiladi
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-tts",
    });

    console.log(`[TTS] Matn uzunligi: ${text.length} belgi | Audio so'ralmoqda...`);
    
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: text.trim() }]
        }
      ],
      generationConfig: {
        responseModalities: ["audio"],
      }
    });

    const candidates = result.response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      const parts = candidates[0].content.parts;
      const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith("audio/"));
      if (audioPart) {
        // Raw PCM (linear 16-bit 24kHz) ga WAV headerini qo'shish
        const wavBase64 = addWavHeader(audioPart.inlineData.data, 24000);
        console.log(`[TTS] Audio tayyor, uzunligi: ${wavBase64.length} bayt base64`);
        return res.json({
          success: true,
          audioData: wavBase64,
          mimeType: "audio/wav"
        });
      }
    }
    
    throw new Error("Gemini modeli audio qaytarmadi.");
  } catch (err) {
    console.error("TTS API xatosi:", err.message);
    res.status(500).json({ success: false, error: "TTS xatosi: " + err.message });
  }
});

// ─── JSON xavfsiz tozalash yordamchi funksiyasi ──────────────────────────────
const safeParseQuizJson = (rawText) => {
  let text = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  // JSON blokini ajratib olish
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON topilmadi');
  text = jsonMatch[0];

  // Keng tarqalgan Gemini JSON xatolarini tuzatish
  text = text
    // Trailing commas: ,} yoki ,]
    .replace(/,\s*([}\]])/g, '$1')
    // Newline ichidagi tiqilib qolgan stringlar
    .replace(/"([^"]*?)\n([^"]*?)"/g, (_, a, b) => `"${a} ${b}"`)
    // Boshqa control characterlar
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  return JSON.parse(text);
};

// ─── POST /api/quiz — test yaratish ──────────────────────────────────────────
app.post("/api/quiz", async (req, res) => {
  try {
    const { topic, studentName } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: "Mavzu kiritilmadi." });

    const topicData = await Topic.findOne({ title: topic });
    if (!topicData) {
      return res.status(404).json({ success: false, error: "Mavzu kontenti topilmadi." });
    }

    const quizPrompt = buildQuizPrompt(topicData, studentName);

    // responseSchema bilan aniq JSON strukturasi talab qilinadi
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature:      0.4,
        maxOutputTokens:  2000,
        responseMimeType: "application/json",
      },
    });

    let quiz = null;
    let lastErr = null;

    // 2 marta urinish
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await model.generateContent(quizPrompt);
        const rawText = result.response.text();
        console.log(`[Quiz] attempt ${attempt} raw (${rawText.length} chars)`);
        quiz = safeParseQuizJson(rawText);
        if (quiz.questions && quiz.questions.length > 0) break;
        throw new Error('Savollar topilmadi');
      } catch (parseErr) {
        console.warn(`[Quiz] attempt ${attempt} xatosi:`, parseErr.message);
        lastErr = parseErr;
      }
    }

    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      throw lastErr || new Error('Quiz yaratib bo\'lmadi');
    }

    // Har bir savolni tozalash (id, correct maydonlari)
    quiz.questions = quiz.questions.map((q, i) => ({
      id:          q.id          ?? i + 1,
      question:    String(q.question   || '').trim(),
      options:     q.options     || {},
      correct:     String(q.correct    || 'A').trim().toUpperCase(),
      explanation: String(q.explanation|| '').trim(),
    }));

    console.log(`[Quiz] Mavzu: "${topic}" | Savollar: ${quiz.questions.length}`);
    res.json({ success: true, quiz, topic });
  } catch (err) {
    console.error("Quiz API xatosi:", err.message);
    res.status(500).json({ success: false, error: "Test yaratib bo'lmadi: " + err.message });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const studentsCount = isMongoConnected ? await Student.countDocuments() : 0;
  
  res.json({
    status:          isMongoConnected ? "OK" : "ERROR",
    message:         isMongoConnected ? "Ziyo AI O'qituvchi serveri va MongoDB ishlayapti! 🎓" : "MongoDB ulanishida xatolik mavjud! ⚠️",
    timestamp:       new Date().toISOString(),
    geminiConnected: !!process.env.GEMINI_API_KEY,
    mongoConnected:  isMongoConnected,
    model:           MODEL_NAME,
    studentsCount:   studentsCount,
  });
});

// ─── DELETE /api/chat/session/:sessionId ─────────────────────────────────────
app.delete("/api/chat/session/:sessionId", async (req, res) => {
  try {
    await ChatSession.deleteOne({ sessionId: req.params.sessionId });
    res.json({ success: true, message: "Chat tarixi o'chirildi." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Server Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   🎓 Ziyo AI Maktab — 7-sinf Algebra            ║");
  console.log(`║   Server: http://localhost:${PORT}                 ║`);
  console.log(`║   Model: ${MODEL_NAME.padEnd(38)}║`);
  console.log("║   Database: MongoDB Connected ✅                 ║");
  console.log("║   Status: Ishga tushdi! ✅                       ║");
  console.log("╚══════════════════════════════════════════════════╝");
});
