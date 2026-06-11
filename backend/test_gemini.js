require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("API Key:", apiKey ? "Mavjud (Uzunligi: " + apiKey.length + ")" : "Topilmadi!");
  
  if (!apiKey) return;

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Modellar ro'yxatini olishga urinib ko'rish (REST API orqali)
  try {
    console.log("\n--- REST API orqali mavjud modellarni olish ---");
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => null);
    
    // Agar node-fetch bo'lmasa, global fetch dan foydalanamiz (Node 18+ da fetch bor)
    const response = await global.fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      console.log("Mavjud modellar:");
      data.models.forEach(m => console.log(` - ${m.name} (${m.displayName})`));
    } else {
      console.log("Modellar ro'yxatini olib bo'lmadi:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Modellar ro'yxatini olishda xato:", err.message);
  }

  // 2. gemini-1.5-flash ni sinab ko'rish
  try {
    console.log("\n--- gemini-1.5-flash modelini sinash ---");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Salom, 2+2 nechiga teng?");
    console.log("Javob:", result.response.text());
  } catch (err) {
    console.error("gemini-1.5-flash xatosi:", err.message);
  }

  // 3. gemini-2.5-flash ni sinab ko'rish
  try {
    console.log("\n--- gemini-2.5-flash modelini sinash ---");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Salom, 2+2 nechiga teng?");
    console.log("Javob:", result.response.text());
  } catch (err) {
    console.error("gemini-2.5-flash xatosi:", err.message);
  }
}

test();
