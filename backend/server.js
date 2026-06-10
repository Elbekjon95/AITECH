require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// ─── Gemini AI Setup ──────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// "Ziyo" AI o'qituvchisi uchun system prompt (O'zbek tilida)
const ZIYO_SYSTEM_PROMPT = `Siz maktab o'quvchilariga dars o'tadigan mehribon, aqlli va qiziqarli Virtual AI O'qituvchisiz. 
Ismingiz 'Ziyo'. 
Faqat sodda o'zbek tilida (lotin alifbosida) javob bering. 
O'quvchini har bir gapda ruhlantiring ('Barakalla!', 'Juda yaxshi!'). 
Faqat ta'limiy savollarga javob bering, maksimal 3-4 ta gapdan oshmasin.`;

// ─── Chat History (In-memory, per session) ────────────────────────────────────
// Production'da Redis yoki DB ishlatish tavsiya etiladi
const chatSessions = new Map();

// ─── POST /api/chat ───────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId, lessonContext } = req.body;

    // Kiruvchi ma'lumotlarni tekshirish
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Xabar bo'sh bo'lmasligi kerak.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Gemini API kaliti topilmadi. .env faylini tekshiring.",
      });
    }

    // Gemini modeli
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: ZIYO_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 256,
      },
    });

    // Session ID bo'yicha chat tarixini olish yoki yangi yaratish
    const sid = sessionId || "default";
    if (!chatSessions.has(sid)) {
      chatSessions.set(sid, []);
    }
    const history = chatSessions.get(sid);

    // Chat boshlash
    const chat = model.startChat({ history });

    // Dars kontekstini xabar bilan birlashtirish
    const fullMessage = lessonContext
      ? `[Bugungi dars: ${lessonContext}]\nO'quvchi savoli: ${message.trim()}`
      : message.trim();

    // Javob olish
    const result = await chat.sendMessage(fullMessage);
    const responseText = result.response.text();

    // Tarixni yangilash
    history.push(
      { role: "user", parts: [{ text: fullMessage }] },
      { role: "model", parts: [{ text: responseText }] }
    );

    // Tarixni cheklab turish (oxirgi 10 ta xabar)
    if (history.length > 20) {
      chatSessions.set(sid, history.slice(-20));
    }

    console.log(
      `[${new Date().toISOString()}] Session: ${sid} | User: "${message}" | Ziyo: "${responseText.slice(0, 60)}..."`
    );

    res.json({
      success: true,
      response: responseText,
      sessionId: sid,
    });
  } catch (error) {
    console.error("Gemini API xatosi:", error.message);

    // API key xatosi
    if (error.message?.includes("API_KEY_INVALID")) {
      return res.status(401).json({
        success: false,
        error: "Gemini API kaliti noto'g'ri. Iltimos tekshiring.",
      });
    }

    // Quota xatosi
    if (error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        success: false,
        error: "API limiti tugadi. Bir oz kutib yana urinib ko'ring.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Server xatosi yuz berdi. Qaytadan urinib ko'ring.",
    });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Ziyo AI O'qituvchi serveri ishlayapti! 🎓",
    timestamp: new Date().toISOString(),
    geminiConnected: !!process.env.GEMINI_API_KEY,
  });
});

// ─── DELETE /api/chat/session ─────────────────────────────────────────────────
app.delete("/api/chat/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  chatSessions.delete(sessionId);
  res.json({ success: true, message: "Chat tarixi o'chirildi." });
});

// ─── Server Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   🎓 AI Virtual School - Ziyo O'qituvchi    ║");
  console.log(`║   Server: http://localhost:${PORT}               ║`);
  console.log("║   Status: Ishga tushdi! ✅                   ║");
  console.log("╚══════════════════════════════════════════════╝");
});
