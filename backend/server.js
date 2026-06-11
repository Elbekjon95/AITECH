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

// ─── Ziyo o'qituvchi system prompti ──────────────────────────────────────────
const buildLessonPrompt = (studentName, topicTitle, topicData) => `
Sen 7-sinf algebra o'qituvchisi "Ziyo"san. O'zbek tilida (lotin alifbosida) dars ber.
O'quvchi ismi: ${studentName || "aziz o'quvchi"}.
Bugungi mavzu: "${topicTitle}".

Dars davomida o'quvchiga quyidagi rasmiy darslik materialidan foydalanib bilim ber:
---
DARSLIK KONTEKSTI:
1. Ta'rif: ${topicData.definition}
2. Asosiy Qoidalar:
${topicData.rules.map((r, i) => `   ${i+1}) ${r}`).join('\n')}
3. Misollar:
${topicData.examples.map((ex, i) => `   * ${ex.step}: ${ex.expression} -> Izoh: ${ex.explanation}`).join('\n')}
4. Topshiriq (Mashq): ${topicData.exercise.question}
---

Dars o'tish qoidalari va muloqot tartibi:
- Darsni har doim o'quvchini ismi bilan salomlashib boshla va darslik materialini tushuntirishga kirish.
- Faqat o'zbek tilida (lotin alifbosi) javob ber.
- Birinchi navbatda mavzuning Ta'rifini va Qoidalarini juda sodda tilda tushuntir, so'ngra o'quvchidan tushunganligini so'ra.
- O'quvchi tushunganini aytganidan keyin, darslikdagi Misollarni albatta qadamma-qadam (1-qadam, 2-qadam va h.k.) yechilish bosqichlari bilan juda batafsil, chiroyli va tushunarli qilib ko'rsat va o'rgat. Misol yechilishini shunchaki yozib ketma, har bir matematik amalni (masalan, ishoralarning o'zgarishi, bo'linishi yoki ko'paytirilishini) o'quvchiga tahlil qilib tushuntir.
- Misollar to'liq tushuntirilgandan keyingina darslikdagi Topshiriqni (Mashq) o'quvchiga yechish uchun ber va uning javobini kut.
- O'quvchi javob berganida, to'g'ri javobni (${topicData.exercise.correctAnswer}) tekshir. Agar xato qilsa, muloyimlik bilan to'g'irla, to'g'ri topsa "Barakalla!", "Zo'r!", "Ajoyib!" kabi rag'batlantiruvchi so'zlarni ishlat.
- Har bir javobingiz sodda, motivatsion, interaktiv va 4-8 gapdan oshmasin.
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

MUHIM: Faqat JSON formatida javob ber, boshqa hech narsa yozma:
{
  "questions": [
    {
      "id": 1,
      "question": "savol matni",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "explanation": "nima uchun to'g'ri ekanligini qisqacha izohlash"
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
    // Dars uchun ko'proq token
    const model = getModel(systemPrompt, 1200);

    const chat = model.startChat({ history: [] });

    // Aniq dars so'rovi
    const lessonRequest = `"${topic}" mavzusidan dars ber. Quyidagi tartibda:
1) Ta'rif: mavzuning asosiy tushuntirishi
2) Misol: oddiy va tushunarli 1-2 ta misol
3) Mashq: ${studentName || "o'quvchi"} uchun bitta amaliy topshiriq
Faqat o'zbek tilida, 7-sinf darajasida yoz.`;

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
    const model = getModel(systemPrompt, 512);
    
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

// ─── POST /api/quiz — test yaratish ──────────────────────────────────────────
app.post("/api/quiz", async (req, res) => {
  try {
    const { topic, studentName } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: "Mavzu kiritilmadi." });

    // Bazadan mavzu kontentini olish
    const topicData = await Topic.findOne({ title: topic });
    if (!topicData) {
      return res.status(404).json({ success: false, error: "Mavzu kontenti topilmadi." });
    }

    const quizPrompt = buildQuizPrompt(topicData, studentName);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature:     0.5,
        maxOutputTokens: 2000,
      },
    });

    const result = await model.generateContent(quizPrompt);
    let text = result.response.text();

    text = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON topilmadi");
    text = jsonMatch[0];

    const quiz = JSON.parse(text);
    if (!quiz.questions || quiz.questions.length === 0) {
      throw new Error("Savollar topilmadi");
    }

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
  console.log(`║   Model: ${MODEL_NAME}                              ║`);
  console.log("║   Database: MongoDB Connected ✅                 ║");
  console.log("║   Status: Ishga tushdi! ✅                       ║");
  console.log("╚══════════════════════════════════════════════════╝");
});
