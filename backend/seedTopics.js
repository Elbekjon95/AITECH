require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('./models/Topic');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ziyo_ai_school';

const topicsData = [
  {
    topicId: 1,
    title: "Natural sonlar va ularning xossalari",
    emoji: "🔢",
    definition: "Narsalarni sanashda ishlatiladigan 1, 2, 3, 4, 5, ... kabi sonlar natural sonlar deyiladi. Natural sonlar to'plami N harfi bilan belgilanadi. Eng kichik natural son — 1. Nol (0) natural son hisoblanmaydi.",
    rules: [
      "Kommutativlik (ko'chish) xossasi: a + b = b + a  va  a · b = b · a",
      "Assotsiativlik (birikish) xossasi: (a + b) + c = a + (b + c)",
      "Taqsimot xossasi: a · (b + c) = a · b + a · c",
      "Nolga bo'lish mumkin emas. Nolga ko'paytirish natijasi doim 0."
    ],
    examples: [
      {
        step: "Qo'shish",
        expression: "346 + 278 = 624",
        explanation: "Birliklar: 6+8=14, 1 o'nlik ko'tariladi. O'nliklar: 4+7+1=12, 1 yuzlik ko'tariladi. Yuzliklar: 3+2+1=6. Natija: 624."
      },
      {
        step: "Ayirish",
        expression: "500 − 163 = 337",
        explanation: "0 dan 3 ni ayirish uchun o'nlik qarzga olamiz: 10−3=7. O'nliklar: 9−6=3. Yuzliklar: 4−1=3. Natija: 337."
      },
      {
        step: "Ko'paytirish",
        expression: "34 · 12 = 408",
        explanation: "34·2=68, 34·10=340. 68+340=408. Taqsimot xossasi: 34·(10+2)=340+68=408."
      },
      {
        step: "Bo'lish",
        expression: "144 ÷ 12 = 12",
        explanation: "12·10=120, 12·2=24, 120+24=144. Demak, 144÷12=12. Tekshirish: 12·12=144 ✓"
      }
    ],
    exercise: {
      question: "528 + 375 va 903 − 256 ni hisoblang. Javoblarni aytib bering.",
      correctAnswer: "903 va 647",
      hint: "Birliklar, o'nliklar, yuzliklar tartibida hisoblang."
    }
  },

  {
    topicId: 2,
    title: "Butun sonlar",
    emoji: "➕",
    definition: "Natural sonlar, ularga qarama-qarshi bo'lgan manfiy sonlar va nol birgalikda butun sonlar to'plamini tashkil qiladi. Z = {…, −3, −2, −1, 0, 1, 2, 3, …}. Har bir musbat sonning manfiy tomonda qarama-qarshisi mavjud: 5 ning qarama-qarshisi −5.",
    rules: [
      "Bir xil ishorali sonlarni qo'shish: modullarni qo'shib, umumiy ishorani qo'yamiz. (−4)+(−9) = −13",
      "Har xil ishorali sonlarni qo'shish: katta moduldan kichigini ayirib, katta modulning ishorasini qo'yamiz. (−10)+6 = −4",
      "Ayirish: qarama-qarshi songa qo'shishga almashtirish. a − b = a + (−b)",
      "Ko'paytirish/bo'lish: bir xil ishorali → musbat; har xil ishorali → manfiy."
    ],
    examples: [
      {
        step: "Bir xil ishorali qo'shish",
        expression: "(−5) + (−8) = −13",
        explanation: "Ikkala son ham manfiy. Modullar: 5+8=13. Umumiy ishorasi '−'. Natija: −13."
      },
      {
        step: "Har xil ishorali qo'shish",
        expression: "(−10) + 6 = −4",
        explanation: "Katta modul 10 (manfiy). 10−6=4. Ishorasi '−' (katta modulniki). Natija: −4."
      },
      {
        step: "Ayirish",
        expression: "3 − (−7) = 3 + 7 = 10",
        explanation: "Manfiy songa ko'chish: −(−7)=+7. Shuning uchun 3+(+7)=10."
      },
      {
        step: "Ko'paytirish va bo'lish",
        expression: "(−6) · (−4) = +24;   (−15) ÷ 3 = −5",
        explanation: "(−)·(−)=+ bo'lgani uchun 6·4=24 → +24.   (−)÷(+)=− bo'lgani uchun 15÷3=5 → −5."
      }
    ],
    exercise: {
      question: "(−15) + 20 ni hisoblang va (−3) · (−8) ning qiymatini toping.",
      correctAnswer: "5 va 24",
      hint: "Birinchi: har xil ishorali, katta modul 20 — manfiy. Ikkinchi: ikki manfiy — musbat."
    }
  },

  {
    topicId: 3,
    title: "Oddiy kasrlar",
    emoji: "½",
    definition: "Butunning teng bo'lingan ulushlarini ifodalovchi son kasr deyiladi. a/b shaklida yoziladi: a — surat (nechi ulush olingan), b — maxraj (nechta teng bo'lakka bo'lingan). Masalan 3/4 — to'rtdan uch.",
    rules: [
      "Qo'shish/ayirish (teng maxrajli): suratlarni qo'sh/ayir, maxraj o'zgarmaydi. 2/7 + 3/7 = 5/7",
      "Qo'shish/ayirish (har xil maxrajli): umumiy maxraj topib, suratlarni moslashtir. 1/4 + 1/6 = 3/12 + 2/12 = 5/12",
      "Ko'paytirish: surat × surat, maxraj × maxraj. (2/3)·(4/5) = 8/15",
      "Bo'lish: ikkinchi kasrni teskari qilib ko'paytir. (2/3)÷(4/5) = (2/3)·(5/4) = 10/12 = 5/6"
    ],
    examples: [
      {
        step: "Teng maxrajli qo'shish",
        expression: "3/8 + 1/8 = 4/8 = 1/2",
        explanation: "Maxrajlar teng (8). Suratlarni qo'shamiz: 3+1=4. Natija 4/8, qisqartiriladi: 4÷4 / 8÷4 = 1/2."
      },
      {
        step: "Har xil maxrajli qo'shish",
        expression: "1/3 + 1/4 = 4/12 + 3/12 = 7/12",
        explanation: "Umumiy maxraj: 3 va 4 ning UKQK = 12. 1/3 = 4/12 (3·4=12, surat 1·4=4). 1/4 = 3/12 (4·3=12, surat 1·3=3). 4/12 + 3/12 = 7/12."
      },
      {
        step: "Ayirish",
        expression: "5/6 − 1/4 = 10/12 − 3/12 = 7/12",
        explanation: "UKQK(6,4)=12. 5/6=10/12 (5·2/6·2). 1/4=3/12 (1·3/4·3). 10/12−3/12=7/12."
      },
      {
        step: "Ko'paytirish",
        expression: "(3/4) · (2/9) = 6/36 = 1/6",
        explanation: "Surat: 3·2=6. Maxraj: 4·9=36. 6/36 = 1/6 (ikkalasini 6 ga bo'lib qisqartiramiz)."
      },
      {
        step: "Bo'lish",
        expression: "(3/4) ÷ (3/8) = (3/4) · (8/3) = 24/12 = 2",
        explanation: "Bo'lishda ikkinchi kasrni teskari yozamiz: 3/8 → 8/3. So'ngra ko'paytiramiz: 3·8=24, 4·3=12. 24/12=2."
      }
    ],
    exercise: {
      question: "Hisoblang: a) 2/5 + 1/3   b) 3/4 − 1/6   c) (2/3)·(9/4)   d) (5/6)÷(5/12)",
      correctAnswer: "a)11/15  b)7/12  c)3/2=1½  d)2",
      hint: "a) UKQK(5,3)=15. b) UKQK(4,6)=12. c) Surat·surat, maxraj·maxraj. d) Teskari qilib ko'paytir."
    }
  },

  {
    topicId: 4,
    title: "O'nli kasrlar",
    emoji: "0️⃣",
    definition: "Maxraji 10, 100, 1000 va hokazo bo'lgan oddiy kasrlarni vergul yordamida yozish o'nli kasr deyiladi. Masalan: 3/10 = 0.3; 47/100 = 0.47; 5/1000 = 0.005. Vergildan chapda — butun qism, o'ngda — kasr qism.",
    rules: [
      "Qo'shish/ayirish: vergullarni tagma-tag qo'yib, odatdagidek hisoblash.",
      "Ko'paytirish: vergulni e'tiborsiz ko'paytir, so'ng umumiy kasr raqamlari sonini o'ngdan sana.",
      "Bo'lish: bo'luvchini butun songa aylantirib, bo'linuvchining vergulini ham shu qadar o'ngga siljit.",
      "O'nli kasrni foizga aylantirish: 100 ga ko'paytir. 0.35 = 35%."
    ],
    examples: [
      {
        step: "Qo'shish",
        expression: "3.75 + 2.4 = 6.15",
        explanation: "Vergullar tagma-tag: 3.75 + 2.40. Birliklar: 5+0=5. O'nliklar: 7+4=11, 1 ko'tariladi. Butunlar: 3+2+1=6. Natija: 6.15."
      },
      {
        step: "Ayirish",
        expression: "5.3 − 2.87 = 2.43",
        explanation: "5.30 − 2.87. 0<7, qarzga olish: 10−7=3. O'nliklar: 2−1(qarz)−8<0, yana qarzga: 12−1−8=3. Butunlar: 4−2=2. Natija: 2.43."
      },
      {
        step: "Ko'paytirish",
        expression: "1.2 × 0.5 = 0.60",
        explanation: "Vergulsiz: 12 × 5 = 60. Jami kasr raqam: 1+1=2. 60 → 0.60 (vergulni 2 o'rin chapga). Natija: 0.6."
      },
      {
        step: "Bo'lish",
        expression: "3.6 ÷ 0.4 = 36 ÷ 4 = 9",
        explanation: "0.4 ni butun qilish uchun ikkalasini 10 ga ko'paytiramiz: 3.6→36, 0.4→4. 36÷4=9."
      }
    ],
    exercise: {
      question: "Hisoblang: a) 4.6 + 2.85   b) 7.2 − 3.56   c) 2.4 × 1.5   d) 8.1 ÷ 0.9",
      correctAnswer: "a)7.45  b)3.64  c)3.6  d)9",
      hint: "c) da 24×15=360, kasr raqam 1+1=2, demak 3.60. d) da ikkalasini 10 ga ko'paytir."
    }
  },

  {
    topicId: 5,
    title: "Nisbat va proporsiya",
    emoji: "⚖️",
    definition: "Ikki sonning nisbati deb ularning bo'linmasiga aytiladi: a : b = a/b. Ikki nisbatning tengligi proporsiya deyiladi: a : b = c : d yoki a/b = c/d.",
    rules: [
      "Proporsiyaning asosiy xossasi: chetki hadlar ko'paytmasi = o'rta hadlar ko'paytmasi. a·d = b·c",
      "Noma'lum hadni topish: asosiy xossaga ko'ra tenglamani yechamiz.",
      "To'g'ri proporsional miqdorlar: biri 2 marta ko'paysa, ikkinchisi ham 2 marta ko'payadi.",
      "Teskari proporsional miqdorlar: biri 2 marta ko'paysa, ikkinchisi 2 marta kamayadi."
    ],
    examples: [
      {
        step: "Noma'lum hadni topish",
        expression: "x/4 = 9/12 → x·12 = 4·9 → 12x = 36 → x = 3",
        explanation: "Asosiy xossani qo'lladik: x·12 = 4·9 = 36. So'ng x = 36÷12 = 3."
      },
      {
        step: "Masalada qo'llash",
        expression: "3 soatda 150 km → 5 soatda ? km. 3/150 = 5/x → x = 150·5/3 = 250 km",
        explanation: "Tezlik o'zgarmaydi (to'g'ri proporsiya). 3·x = 150·5 → x = 750/3 = 250."
      }
    ],
    exercise: {
      question: "3 : 5 = 12 : x dan x ni toping. Va: 8 ta daftar 24 000 so'm bo'lsa, 5 ta daftar necha so'm?",
      correctAnswer: "x=20;  15 000 so'm",
      hint: "Birinchi: 3·x=5·12=60, x=20. Ikkinchi: to'g'ri proporsiya, 8/24000=5/y."
    }
  },

  {
    topicId: 6,
    title: "Foizlar",
    emoji: "💯",
    definition: "Sonning yuzdan bir ulushi 1 foiz deb ataladi va % belgisi bilan yoziladi: 1% = 1/100 = 0.01. Foizlar amaliy hayotda chegirma, soliq, o'sish hisoblashda ishlatiladi.",
    rules: [
      "Sonning foizini topish: son × (foiz/100).  Masalan: 200 ning 15% = 200 × 0.15 = 30.",
      "Foizni sondan topish: (qism / butun) × 100%.  Masalan: 30 — 200 ning necha foizi? 30/200 × 100% = 15%.",
      "Butunni foiz va uning qiymatidan topish: butun = qism / (foiz/100).  Masalan: 30 — nechaning 15%? 30/0.15 = 200.",
      "Foizli o'sish: yangi = eski × (1 + foiz/100).  Kamayish: yangi = eski × (1 − foiz/100)."
    ],
    examples: [
      {
        step: "Sonning foizini topish",
        expression: "500 ning 20% = 500 × 20/100 = 500 × 0.2 = 100",
        explanation: "20% = 20/100 = 0.2. 500 ni 0.2 ga ko'paytiramiz: 100."
      },
      {
        step: "Foizni qiymatdan topish",
        expression: "60 — 240 ning necha foizi? (60/240)×100% = 0.25×100% = 25%",
        explanation: "60 ni 240 ga bo'lamiz: 60/240=0.25. 0.25×100=25%."
      },
      {
        step: "Chegirma hisoblash",
        expression: "Narxi 80 000 so'm, chegirma 15%. Yangi narx = 80 000 × (1 − 0.15) = 80 000 × 0.85 = 68 000",
        explanation: "15% chegirma = narxning 85% i qoladi. 80 000 × 0.85 = 68 000 so'm."
      }
    ],
    exercise: {
      question: "a) 350 ning 40% ini toping.   b) 48 — 160 ning necha foizi?   c) Mahsulot 120 000 so'm, narx 25% oshdi — yangi narx?",
      correctAnswer: "a)140  b)30%  c)150 000 so'm",
      hint: "a) 350×0.4. b) 48/160×100. c) 120 000×1.25."
    }
  },

  {
    topicId: 7,
    title: "Algebraik ifodalar va o'zgaruvchilar",
    emoji: "🔤",
    definition: "Harflar (o'zgaruvchilar) va sonlarni arifmetik amallar yordamida birlashtirgan ifoda algebraik ifoda deyiladi. Masalan: 3x + 2y − 5. O'zgaruvchi o'rniga son qo'yilganda ifodaning son qiymati topiladi.",
    rules: [
      "O'xshash hadlarni birlashtirish: 3x + 5x = 8x; 7y − 2y = 5y.",
      "Qavslarni ochish (musbat ishorali): +(a + b) = a + b.",
      "Qavslarni ochish (manfiy ishorali): −(a + b) = −a − b; −(a − b) = −a + b.",
      "Taqsimot xossasi: k(a + b) = ka + kb."
    ],
    examples: [
      {
        step: "Ifoda qiymatini hisoblash",
        expression: "a=3, b=−2 da: 2a² − 3b + 1 = 2·9 − 3·(−2) + 1 = 18 + 6 + 1 = 25",
        explanation: "a=3 → a²=9 → 2·9=18. b=−2 → −3·(−2)=+6. 18+6+1=25."
      },
      {
        step: "O'xshash hadlarni birlashtirish",
        expression: "5x + 3y − 2x + 7y = (5x−2x) + (3y+7y) = 3x + 10y",
        explanation: "x li hadlar: 5x−2x=3x. y li hadlar: 3y+7y=10y. Natija: 3x+10y."
      },
      {
        step: "Qavslarni ochish va soddalashtirish",
        expression: "3(2x − 1) − 2(x + 4) = 6x − 3 − 2x − 8 = 4x − 11",
        explanation: "Taqsimot: 3·2x=6x, 3·(−1)=−3; 2·x=2x, 2·4=8 (manfiy). 6x−2x=4x; −3−8=−11."
      }
    ],
    exercise: {
      question: "a) x=4 da 3x²−2x+5 ni hisoblang.   b) 4(3x−2) − 3(2x+1) ni soddalashtiring.",
      correctAnswer: "a) 45   b) 6x−11",
      hint: "a) 3·16−8+5. b) 12x−8−6x−3."
    }
  },

  {
    topicId: 8,
    title: "Birinchi darajali tenglamalar",
    emoji: "🟰",
    definition: "Noma'lum qatnashgan, o'zgaruvchining eng yuqori darajasi 1 ga teng bo'lgan tenglik — birinchi darajali (chiziqli) tenglama. Umumiy ko'rinishi: ax + b = 0. Tenglamani yechish — noma'lumning qiymatini topish.",
    rules: [
      "Hadni ko'chirish: tenglikning bir tomonidan ikkinchi tomonga o'tkazilganda ishorasi qarama-qarshiga o'zgaradi.",
      "Ikkala tomonni bir xil songa ko'paytirish yoki bo'lish mumkin (noldan tashqari).",
      "Tekshirish: topilgan qiymatni dastlabki tenglamaga qo'yib ko'rish shart."
    ],
    examples: [
      {
        step: "Oddiy tenglama",
        expression: "2x + 6 = 14 → 2x = 14 − 6 → 2x = 8 → x = 4",
        explanation: "+6 ni o'ng tomonga −6 qilib ko'chiramiz: 2x=8. Ikki tomonni 2 ga bo'lamiz: x=4. Tekshirish: 2·4+6=14 ✓"
      },
      {
        step: "Ikki tomonida x bo'lgan tenglama",
        expression: "5x − 3 = 2x + 9 → 5x − 2x = 9 + 3 → 3x = 12 → x = 4",
        explanation: "2x ni chap tomonga, −3 ni o'ng tomonga ko'chiramiz. 3x=12. x=4. Tekshirish: 5·4−3=17, 2·4+9=17 ✓"
      },
      {
        step: "Kasr koeffisiyentli tenglama",
        expression: "x/3 + 2 = 5 → x/3 = 3 → x = 9",
        explanation: "+2 ni o'ng tomonga −2 qilib ko'chiramiz: x/3=3. Ikki tomonni 3 ga ko'paytiramiz: x=9. Tekshirish: 9/3+2=5 ✓"
      }
    ],
    exercise: {
      question: "Yeching: a) 3x − 8 = 16   b) 4x + 5 = 2x − 3   c) x/4 − 1 = 2",
      correctAnswer: "a) x=8   b) x=−4   c) x=12",
      hint: "a) 3x=24. b) 2x=−8. c) x/4=3."
    }
  },

  {
    topicId: 9,
    title: "Tengsizliklar",
    emoji: "📐",
    definition: "Ikki ifodani >, <, ≥, ≤ belgilari bilan bog'lash tengsizlik deyiladi. Tengsizlikni yechish — uning barcha yechimlar to'plamini (haqiqiy bo'lgan x larni) topish.",
    rules: [
      "Qo'shish/ayirish: ikkala tomonga bir xil son qo'shilsa/ayirilsa, belgi o'zgarmaydi.",
      "Musbat songa ko'paytirish/bo'lish: belgi o'zgarmaydi.",
      "Manfiy songa ko'paytirish/bo'lish: belgi QARAMA-QARSHIGA o'zgaradi! (< → >, > → <)",
      "Yechimni son o'qida ko'rsatish: x > 3 uchun (3; +∞), x ≤ 5 uchun (−∞; 5]."
    ],
    examples: [
      {
        step: "Oddiy tengsizlik",
        expression: "3x − 7 > 8 → 3x > 15 → x > 5",
        explanation: "+7 ko'chiramiz: 3x>15. Musbat 3 ga bo'lamiz (belgi o'zgarmaydi): x>5. Yechim: (5; +∞)."
      },
      {
        step: "Manfiy songa bo'lish",
        expression: "−2x ≤ 10 → x ≥ −5",
        explanation: "−2 (manfiy) ga bo'lganimiz uchun belgi o'zgaradi: ≤ → ≥. Yechim: [−5; +∞)."
      },
      {
        step: "Qo'sh tengsizlik",
        expression: "−1 < 2x + 3 ≤ 7 → −4 < 2x ≤ 4 → −2 < x ≤ 2",
        explanation: "Har uch tomondan 3 ayiramiz. So'ng 2 ga bo'lamiz (belgi o'zgarmaydi). Yechim: (−2; 2]."
      }
    ],
    exercise: {
      question: "Yeching: a) 4x + 2 > 18   b) −3x < 15   c) 1 ≤ 3x − 5 < 10",
      correctAnswer: "a) x>4   b) x>−5   c) 2≤x<5",
      hint: "a) 4x>16. b) belgi o'zgaradi! c) har uch tomonga +5 qo'sh, so'ng 3 ga bo'l."
    }
  },

  {
    topicId: 10,
    title: "Koordinatalar sistemasi",
    emoji: "🗺️",
    definition: "Tekislikdagi har bir nuqtaning holatini aniqlash uchun ishlatiladi. O'zaro perpendikulyar Ox (abssissa) va Oy (ordinata) o'qlari sanoq boshi O da kesishadi. Nuqta A(x; y) da x — gorizontal, y — vertikal koordinata.",
    rules: [
      "I chorak: x>0, y>0.  II chorak: x<0, y>0.  III chorak: x<0, y<0.  IV chorak: x>0, y<0.",
      "Ox o'qidagi nuqtalarda y=0.  Oy o'qidagi nuqtalarda x=0.",
      "Ikki nuqta orasidagi masofa: d = √((x₂−x₁)² + (y₂−y₁)²).",
      "Kesmaning o'rta nuqtasi: M = ((x₁+x₂)/2 ; (y₁+y₂)/2)."
    ],
    examples: [
      {
        step: "Nuqtani aniqlash",
        expression: "A(3; −2): x=3 (o'ngga 3), y=−2 (pastga 2). IV chorakda.",
        explanation: "x musbat → o'ngda. y manfiy → pastda. IV chorak (x>0, y<0)."
      },
      {
        step: "Masofa hisoblash",
        expression: "A(1; 2) va B(4; 6) orasidagi masofa: d = √((4−1)²+(6−2)²) = √(9+16) = √25 = 5",
        explanation: "Δx=3, Δy=4. d=√(9+16)=√25=5 birlik."
      }
    ],
    exercise: {
      question: "A(−3; 4) va B(1; 1) nuqtalar qaysi choraklarda? Ular orasidagi masofani toping.",
      correctAnswer: "A II chorak, B I chorak; d=5",
      hint: "A: x<0,y>0 → II. B: x>0,y>0 → I. d=√((1+3)²+(1−4)²)=√(16+9)=5."
    }
  },

  {
    topicId: 11,
    title: "Funksiyalar va grafik",
    emoji: "📈",
    definition: "Har bir x qiymatiga yagona y qiymat mos kelishi qoidasi funksiya deyiladi: y = f(x). x — argument, y — funksiya qiymati. Chiziqli funksiya: y = kx + b (grafigi to'g'ri chiziq). Kvadratik funksiya: y = ax² (grafigi parabola).",
    rules: [
      "y = kx + b: k — og'ish burchagi koeffisiyenti (grafik qiyaligi), b — y o'qidagi kesma (x=0 da y=b).",
      "k > 0 → grafik o'sadi (chapdan o'ngga yuqorilaydi). k < 0 → grafik kamayadi.",
      "Grafik chizish: kamida 2−3 ta nuqta (x,y) hisoblang, nuqtalarni ulang.",
      "Grafik va o'q kesishishi: Ox bilan → y=0 qo'yib x topamiz. Oy bilan → x=0 qo'yib y topamiz."
    ],
    examples: [
      {
        step: "Funksiya qiymatlarini hisoblash",
        expression: "y = 2x − 3 uchun: x=0 → y=−3; x=2 → y=1; x=−1 → y=−5",
        explanation: "Har bir x uchun formulaga qo'yamiz. 3 ta nuqta: (0;−3), (2;1), (−1;−5)."
      },
      {
        step: "O'qlar bilan kesishish",
        expression: "y=2x−3: Ox bilan: 0=2x−3 → x=1.5 → (1.5; 0). Oy bilan: x=0 → y=−3 → (0; −3).",
        explanation: "Ox bilan kesishish uchun y=0 qo'yib x topamiz. Oy bilan kesishish uchun x=0 qo'yamiz."
      }
    ],
    exercise: {
      question: "y = 3x + 1 funksiyasi uchun: a) x=0,1,2 da y ni hisoblang. b) Ox va Oy bilan kesishish nuqtalarini toping.",
      correctAnswer: "a) y=1,4,7   b) Ox: (−1/3; 0), Oy: (0; 1)",
      hint: "a) 3·0+1=1, 3·1+1=4, 3·2+1=7. b) Ox: 0=3x+1 → x=−1/3."
    }
  },

  {
    topicId: 12,
    title: "Ko'paytirish va bo'lish",
    emoji: "✖️",
    definition: "Ko'paytirish — bir xil qo'shiluvchilarni qo'shishning qisqacha yozilishi. Bo'lish — ko'paytirishga teskari amal. Butun sonlar, kasrlar va algebraik ifodalar ustida bu amallarni bajarishni o'rganamiz.",
    rules: [
      "Ishoralar: (+)·(+)=+; (−)·(−)=+; (+)·(−)=−; (−)·(+)=−.",
      "Taqsimot xossasi: a·(b+c) = a·b + a·c. Qavslarni ochishda ishlatiladi.",
      "Kasrlarni ko'paytirish: surat×surat, maxraj×maxraj. Bo'lish: teskari kasrga ko'paytirish.",
      "Nolga ko'paytirish: a·0=0. Nolga bo'lish: mumkin emas!"
    ],
    examples: [
      {
        step: "Butun sonlarni ko'paytirish",
        expression: "(−6) · (+8) = −48;   (+7) · (−5) = −35;   (−4) · (−9) = +36",
        explanation: "Har xil ishorali → manfiy: 6·8=48 → −48. 7·5=35 → −35. Bir xil ishorali → musbat: 4·9=36 → +36."
      },
      {
        step: "Taqsimot xossasini qo'llash",
        expression: "7 · (100 + 3) = 7·100 + 7·3 = 700 + 21 = 721",
        explanation: "103 ni 100+3 qilib yozdik. Keyin 7 ni har biriga ko'paytirdik. Bu usul tez hisoblashda qulay."
      },
      {
        step: "Kasrlarni ko'paytirish va bo'lish",
        expression: "(4/5) · (15/8) = 60/40 = 3/2;   (3/4) ÷ (9/16) = (3/4)·(16/9) = 48/36 = 4/3",
        explanation: "Ko'paytirish: 4·15=60, 5·8=40, 60/40=3/2. Bo'lish: 9/16 ning teskari → 16/9. 3·16=48, 4·9=36, 48/36=4/3."
      },
      {
        step: "Aralash son",
        expression: "2⅓ · 1½ = (7/3) · (3/2) = 21/6 = 3½",
        explanation: "Aralash sonlarni noto'g'ri kasrga o'tkazamiz: 2⅓=7/3, 1½=3/2. Ko'paytiramiz: 7·3=21, 3·2=6. 21/6=3½."
      }
    ],
    exercise: {
      question: "Hisoblang: a) (−12)·(+5)   b) (−8)·(−7)   c) 6·(20−3)   d) (5/6)·(12/25)   e) (7/8)÷(7/4)",
      correctAnswer: "a)−60  b)+56  c)102  d)2/5  e)1/2",
      hint: "a) har xil ishorali. b) bir xil ishorali. c) taqsimot. d) qisqartiring: 5/25=1/5, 12/6=2. e) teskari qilib ko'paytir."
    }
  }
];

async function seed() {
  try {
    console.log('MongoDB ga ulanish...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB ulanishi muvaffaqiyatli! ✅');

    console.log('Mavjud mavzular tozalanmoqda...');
    await Topic.deleteMany({});
    console.log('Tozalash yakunlandi. Yangi mavzular yuklanmoqda...');

    await Topic.insertMany(topicsData);
    console.log('Barcha 12 ta darslik mavzulari muvaffaqiyatli yuklandi! 🎓🎉');
    console.log('Mavzular:');
    topicsData.forEach(t => console.log(`  ${t.topicId}. ${t.emoji} ${t.title}`));

  } catch (error) {
    console.error('Yuklashda xatolik:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB ulanishi yopildi.');
    process.exit(0);
  }
}

seed();
