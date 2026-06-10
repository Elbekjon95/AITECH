require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('./models/Topic');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ziyo_ai_school';

const topicsData = [
  {
    topicId: 1,
    title: "Natural sonlar va ularning xossalari",
    emoji: "🔢",
    definition: "Narsalarni sanashda ishlatiladigan sonlar natural sonlar deyiladi. Natural sonlar to'plami N harfi bilan belgilanadi. Masalan: 1, 2, 3, 4, ... va hokazo.",
    rules: [
      "Eng kichik natural son 1 dir. Eng katta natural son mavjud emas (sonlar cheksiz).",
      "Nol (0) natural son hisoblanmaydi.",
      "Ikkita natural sonning yig'indisi va ko'paytmasi har doim natural son bo'ladi."
    ],
    examples: [
      {
        step: "Amal xossasi",
        expression: "15 + 25 = 40 (Natural son)",
        explanation: "15 va 25 natural sonlarining yig'indisi ham natural son hisoblanadi."
      }
    ],
    exercise: {
      question: "Quyidagi sonlar ichidan natural son bo'lmaganini aniqlang: 1, 27, 0, 999.",
      correctAnswer: "0",
      hint: "Sanoq boshlanadigan eng kichik natural son 1 dir."
    }
  },
  {
    topicId: 2,
    title: "Butun sonlar",
    emoji: "➕",
    definition: "Natural sonlar, ularga qarama-qarshi bo'lgan sonlar (manfiy sonlar) va nol birgalikda butun sonlar to'plamini tashkil qiladi. U Z harfi bilan belgilanadi: Z = {..., -3, -2, -1, 0, 1, 2, 3, ...}.",
    rules: [
      "Nol (0) soni musbat ham emas, manfiy ham emas.",
      "Ikkita manfiy sonni qo'shganda, ularning modullari qo'shiladi va oldiga minus ishorasi qo'yiladi.",
      "Musbat va manfiy sonlarni qo'shganda, moduli kattasidan moduli kichigi ayiriladi va moduli kattasining ishorasi qo'yiladi."
    ],
    examples: [
      {
        step: "Manfiy sonlarni qo'shish",
        expression: "(-5) + (-8) = -13",
        explanation: "Ikkala son ham manfiy bo'lgani uchun, ularning modullari (5 va 8) qo'shildi (13) va natijaga minus (-) qo'yildi."
      },
      {
        step: "Har xil ishorali sonlarni qo'shish",
        expression: "(-10) + 6 = -4",
        explanation: "Moduli kattasi 10. 10 dan 6 ayirildi (4) va moduli kattasining ishorasi (-) qo'yildi."
      }
    ],
    exercise: {
      question: "(-15) + 20 ifodaning qiymatini hisoblang.",
      correctAnswer: "5",
      hint: "20 ning moduli 15 dan katta, shuning uchun natija musbat bo'ladi va 20 dan 15 ayiriladi."
    }
  },
  {
    topicId: 3,
    title: "Oddiy kasrlar",
    emoji: "½",
    definition: "Butunning bir yoki bir nechta teng ulushlarini ifodalovchi son kasr deyiladi. Oddiy kasr a/b ko'rinishida yoziladi, bu yerda a - surat (nechta ulush olinganligi), b - maxraj (butun nechta bo'lakka bo'linganligi).",
    rules: [
      "Maxraj nolga teng bo'lishi mumkin emas (nolga bo'lish mumkin emas).",
      "To'g'ri kasrning surati maxrajidan kichik bo'ladi (qiymati 1 dan kichik).",
      "Noto'g'ri kasrning surati maxrajidan katta yoki teng bo'ladi (qiymati 1 dan katta yoki teng)."
    ],
    examples: [
      {
        step: "Kasrlarni taqqoslash",
        expression: "3/5 < 4/5",
        explanation: "Maxrajlari bir xil bo'lgan kasrlarning surati kattasi katta bo'ladi."
      }
    ],
    exercise: {
      question: "5/8 to'g'ri kasrmi yoki noto'g'ri kasrmi?",
      correctAnswer: "to'g'ri kasr",
      hint: "Surati (5) maxrajidan (8) kichik bo'lgan kasr to'g'ri kasr deyiladi."
    }
  },
  {
    topicId: 4,
    title: "O'nli kasrlar",
    emoji: "0️⃣",
    definition: "Maxraji 10, 100, 1000 va hokazo bo'lgan oddiy kasrlarni vergul yordamida yozish o'nli kasr deyiladi. Masalan, 3/10 = 0.3; 25/100 = 0.25.",
    rules: [
      "Vergildan chapda butun qism, o'ngda esa kasr qism yoziladi.",
      "O'nli kasrning oxiriga istalgancha nol qo'shish yoki o'chirish mumkin, kasr qiymati o'zgarmaydi."
    ],
    examples: [
      {
        step: "Qo'shish amali",
        expression: "2.35 + 1.2 = 3.55",
        explanation: "Kasrlarni qo'shishda vergullar bir tushadigan qilib tagma-tag yoziladi va oddiy sonlardek qo'shiladi."
      }
    ],
    exercise: {
      question: "0.5 va 0.05 sonlaridan qaysi biri katta?",
      correctAnswer: "0.5",
      hint: "Vergildan keyingi birinchi raqamlarni (o'ndan bir ulushlarni) solishtiring."
    }
  },
  {
    topicId: 5,
    title: "Nisbat va proporsiya",
    emoji: "⚖️",
    definition: "Ikki sonning nisbati deb, ularning bo'linmasiga aytiladi. Ikki nisbatning tengligi proporsiya deyiladi: a : b = c : d.",
    rules: [
      "Proporsiyaning chetki hadlari ko'paytmasi uning o'rta hadlari ko'paytmasiga teng bo'ladi (a * d = b * c). Bunga proporsiyaning asosiy xossasi deyiladi."
    ],
    examples: [
      {
        step: "Noma'lum hadni topish",
        expression: "x / 4 = 9 / 12 => x * 12 = 4 * 9 => x = 36 / 12 = 3",
        explanation: "Proporsiyaning asosiy xossasiga ko'ra chetki hadlarni ko'paytirdik (x * 12) va o'rta hadlar ko'paytmasiga tengladik (4 * 9)."
      }
    ],
    exercise: {
      question: "3 : 5 = 12 : x proporsiyadan x ni toping.",
      correctAnswer: "20",
      hint: "3 * x = 5 * 12 tenglamani yeching."
    }
  },
  {
    topicId: 6,
    title: "Foizlar",
    emoji: "💯",
    definition: "Sonning yuzdan bir ulushi foiz deb ataladi. % belgisi bilan ko'rsatiladi: 1% = 1/100 = 0.01.",
    rules: [
      "Sonni foizga aylantirish uchun uni 100 ga ko'paytirib, % belgisini qo'yish kerak.",
      "Foizni songa aylantirish uchun foiz ko'rsatkichini 100 ga bo'lish kerak."
    ],
    examples: [
      {
        step: "Sonning foizini topish",
        expression: "200 ning 15% ini topish: 200 * 0.15 = 30",
        explanation: "200 sonini 15/100 ga yoki 0.15 decimal ko'rinishiga ko'paytirdik."
      }
    ],
    exercise: {
      question: "80 sonining 25% ini toping.",
      correctAnswer: "20",
      hint: "25% bu sonning to'rtdan bir qismidir (1/4 part)."
    }
  },
  {
    topicId: 7,
    title: "Algebraik ifodalar va o'zgaruvchilar",
    emoji: "🔤",
    definition: "Sonlar va o'zgaruvchilar (harflar) amallar (qo'shish, ayirish, ko'paytirish, bo'lish) hamda qavslar yordamida birlashtirilgan ifoda algebraik ifoda deyiladi. Masalan: 3x + 2y - 5.",
    rules: [
      "Algebraik ifodada o'zgaruvchi harflar o'rniga aniq sonlar qo'yilganda, hosil bo'lgan natija algebraik ifodaning son qiymati deyiladi."
    ],
    examples: [
      {
        step: "Ifoda qiymatini hisoblash",
        expression: "a = 5 bo'lganda, 2a + 7 ifodaning qiymati: 2 * 5 + 7 = 17",
        explanation: "Ifodadagi 'a' harfi o'rniga 5 sonini qo'yib, oddiy amallarni bajardik."
      }
    ],
    exercise: {
      question: "x = 4 bo'lganda, 3x - 5 ifodaning qiymati nechaga teng bo'ladi?",
      correctAnswer: "7",
      hint: "x ning o'rniga 4 ni qo'yib hisoblang."
    }
  },
  {
    topicId: 8,
    title: "Birinchi darajali tenglamalar",
    emoji: "🟰",
    definition: "Noma'lum qatnashgan va faqat o'zgaruvchining birinchi darajasi ishtirok etgan tenglik chiziqli tenglama deyiladi. Umumiy ko'rinishi: ax + b = 0, bunda a va b berilgan sonlar, x - noma'lum.",
    rules: [
      "Tenglamaning istalgan hadini uning ishorasini qarama-qarshisiga o'zgartirib, tenglikning bir qismidan ikkinchi qismiga o'tkazish mumkin."
    ],
    examples: [
      {
        step: "Tenglamani yechish",
        expression: "3x - 5 = 10 => 3x = 10 + 5 => 3x = 15 => x = 5",
        explanation: "Dastlab -5 sonini o'ng tomonga +5 qilib o'tkazdik. Keyin hosil bo'lgan 15 sonini 3 ga bo'lib javobni topdik."
      }
    ],
    exercise: {
      question: "2x + 8 = 16 tenglamani yeching.",
      correctAnswer: "4",
      hint: "+8 ni o'ng tomonga -8 qilib o'tkazing, keyin 2 ga bo'ling."
    }
  },
  {
    topicId: 9,
    title: "Tengsizliklar",
    emoji: "📐",
    definition: "Sonlarni yoki algebraik ifodalarni katta (>), kichik (<), katta yoki teng (>=), kichik yoki teng (<=) belgilari yordamida taqqoslash tengsizlik deyiladi.",
    rules: [
      "Tengsizlikning ikkala qismiga bir xil sonni qo'shsa yoki ayirsa, tengsizlik belgisi o'zgarmaydi.",
      "Tengsizlikning ikkala qismini manfiy songa ko'paytirganda yoki bo'lganda, tengsizlik belgisi qarama-qarshisiga o'zgaradi (MUHIM qoida!)."
    ],
    examples: [
      {
        step: "Chiziqli tengsizlikni yechish",
        expression: "2x - 3 > 5 => 2x > 8 => x > 4",
        explanation: "-3 ni o'ng tomonga +3 qilib o'tkazdik (8 bo'ldi), so'ngra 2 ga bo'ldik. Musbat songa bo'lingani uchun belgi o'zgarmadi."
      },
      {
        step: "Manfiy songa bo'lish xossasi",
        expression: "-3x < 9 => x > -3",
        explanation: "Ikkala qismni ham -3 (manfiy son) ga bo'lganimiz sababli '<' belgisi '>' belgisiga o'zgardi."
      }
    ],
    exercise: {
      question: "-2x > 6 tengsizlikning yechimi qanday bo'ladi?",
      correctAnswer: "x < -3",
      hint: "Manfiy songa bo'lganda belgi qarama-qarshi tomonga o'zgarishini unutmang."
    }
  },
  {
    topicId: 10,
    title: "Koordinatalar sistemasi",
    emoji: "🗺️",
    definition: "Tekislikda o'zaro perpendikulyar bo'lgan va sanoq boshi (O nuqta) bitta bo'lgan ikkita son o'qi Dekart koordinatalar sistemasini hosil qiladi. Gorizontal o'q - abssissa (Ox), vertikal o'q - ordinata (Oy) deyiladi.",
    rules: [
      "Tekislikdagi har bir nuqta (x, y) sonlar juftligi bilan aniqlanadi, bu yerda birinchi son - abssissa o'qidagi koordinata, ikkinchi son - ordinata o'qidagi koordinata."
    ],
    examples: [
      {
        step: "Nuqtani aniqlash",
        expression: "A(3, -2) nuqta",
        explanation: "A nuqtaning abssissasi 3 (o'ngda 3 birlik) va ordinatasi -2 (pastga 2 birlik) ga teng."
      }
    ],
    exercise: {
      question: "B(0, 5) nuqta koordinata tekisligining qaysi o'qida yotadi?",
      correctAnswer: "ordinata o'qida",
      hint: "Abssissasi (x) nolga teng bo'lgan nuqtalar har doim ordinata o'qi (Oy) ustida yotadi."
    }
  },
  {
    topicId: 11,
    title: "Funksiyalar va grafik",
    emoji: "📈",
    definition: "Erkli o'zgaruvchi x ning qabul qiladigan qiymatlar to'plamidan olingan har bir qiymatiga erksiz o'zgaruvchi y ning yagona qiymati mos kelishi funksiya deyiladi. y = f(x) ko'rinishida yoziladi.",
    rules: [
      "x - argument (erkli o'zgaruvchi), y - funksiya (erksiz o'zgaruvchi).",
      "Chiziqli funksiyaning umumiy ko'rinishi: y = kx + b, uning grafigi to'g'ri chiziqdan iborat."
    ],
    examples: [
      {
        step: "Funksiya qiymatini topish",
        expression: "y = 2x + 3 funksiyaning x = 5 dagi qiymatini hisoblash: y = 2 * 5 + 3 = 13",
        explanation: "Argument x ning o'rniga 5 sonini qo'yib y ning qiymatini hisobladik."
      }
    ],
    exercise: {
      question: "y = 4x - 1 funksiyada x = 2 bo'lganda y nechaga teng bo'ladi?",
      correctAnswer: "7",
      hint: "Argument o'rniga 2 sonini qo'ying."
    }
  },
  {
    topicId: 12,
    title: "Ko'paytirish va bo'lish",
    emoji: "✖️",
    definition: "Ko'paytirish - bir xil qo'shiluvchilarni qo'shish amalini qisqartirib yozish. Bo'lish - ko'paytirishga teskari bo'lgan amal.",
    rules: [
      "Ko'paytirishning taqsimot xossasi: a * (b + c) = a * b + a * c.",
      "Ishoralar qoidasi: bir xil ishorali sonlar ko'paytmasi musbat (+), har xil ishorali sonlar ko'paytmasi manfiy (-) bo'ladi."
    ],
    examples: [
      {
        step: "Taqsimot xossasini qo'llash",
        expression: "5 * (10 + 2) = 5 * 10 + 5 * 2 = 50 + 10 = 60",
        explanation: "5 sonini qavs ichidagi har bir hadga alohida ko'paytirdik va natijalarni qo'shdik."
      }
    ],
    exercise: {
      question: "(-4) * (-7) ko'paytmaning qiymatini toping.",
      correctAnswer: "28",
      hint: "Ikkita manfiy sonning ko'paytmasi har doim musbat son bo'ladi."
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

  } catch (error) {
    console.error('Yuklashda xatolik:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB ulanishi yopildi.');
    process.exit(0);
  }
}

seed();
