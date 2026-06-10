# 🎓 Ziyo AI Maktab — Virtual Ta'lim Platformasi

> **AI Virtual School** — Real-time yuz aniqlash va Gemini AI o'qituvchi bilan interaktiv ta'lim olish platformasi (O'zbek tilida)

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js) ![Gemini](https://img.shields.io/badge/Google-Gemini_AI-4285F4?logo=google) ![face--api.js](https://img.shields.io/badge/face--api.js-Yuz_aniqlash-FF6B6B) ![GSAP](https://img.shields.io/badge/GSAP-Animatsiya-88CE02)

---

## ✨ Xususiyatlar

- 🎥 **Real-time yuz aniqlash** — face-api.js orqali o'quvchini avtomatik aniqlash
- 🤖 **Ziyo AI O'qituvchi** — Google Gemini API bilan o'zbek tilida dars beradi
- ✨ **GSAP animatsiyalar** — Har bir AI javobida silliq animatsiya
- 📚 **Interaktiv dars** — "Quyosh tizimi" mavzusi, tez savollar
- 📱 **Responsive dizayn** — Glassmorphism uslubida premium interfeys
- 🔴 **Server monitoring** — Real-vaqt server holati kuzatish

---

## 🚀 Ishga tushirish

### Talablar
- Node.js 18+
- Google Gemini API kaliti ([olish](https://aistudio.google.com/app/apikey))

### 1. Repozitoriyni klonlash
```bash
git clone https://github.com/Elbekjon95/AITECH.git
cd AITECH
```

### 2. Backend sozlash
```bash
cd backend
npm install

# .env faylini yarating
cp .env.example .env
# .env faylini oching va GEMINI_API_KEY ni to'ldiring
```

### 3. Frontend sozlash
```bash
cd ../frontend
npm install
```

### 4. Ishga tushirish (2 ta terminal)

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

---

## 📁 Loyiha tuzilmasi

```
AITECH/
├── backend/
│   ├── server.js          # Express + Gemini API
│   ├── .env.example       # Muhit o'zgaruvchilari namunasi
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── CameraView.jsx   # Yuz aniqlash (face-api.js)
    │   │   └── ChatView.jsx     # AI chat (GSAP + Gemini)
    │   ├── App.jsx
    │   └── index.css            # Premium dizayn tizimi
    └── package.json
```

---

## 🛠️ Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| **Frontend** | React 18, Vite, face-api.js, GSAP |
| **Backend** | Node.js, Express, dotenv, cors |
| **AI** | Google Gemini 1.5 Flash |
| **Styling** | Vanilla CSS, Glassmorphism |

---

## 🔐 Xavfsizlik

- `.env` fayli `.gitignore` ga qo'shilgan — API kalit hech qachon GitHub'ga tushmaydi
- `.env.example` faylini nusxa oling va o'z kalitingizni yozing

---

## 📝 Litsenziya

MIT License © 2025 Elbekjon
