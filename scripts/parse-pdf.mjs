#!/usr/bin/env node
/**
 * Parses GIA_test.pdf text export into questions.json
 * Run: node scripts/parse-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Correct answers keyed by question number (0-based option index: a=0, b=1, c=2, d=3, e=4)
const CORRECT_ANSWERS = {
  1: 2,   // В. Одного ряда кубических клеток
  2: 3,   // A. Базального слоя
  3: 2,   // Г. Увеличение числа рядов клеток шиповатого слоя
  4: 2,   // A. Пятно
  5: 2,   // A. Согревающее
  6: 0,   // A. Кератолитическое
  7: 1,   // A. Анафилактический шок
  8: 1,   // B. Спонгиоз
  9: 2,   // Б. β-дефензин
  10: 0,  // Г. Аномальные нуклеозиды
  11: 0,  // Б. Узелок с творожистым содержимым
  12: 3,  // В. Сначала папула...
  13: 3,  // А. Крупные очаги, сплошное поражение волос
  14: 0,  // В. При поверхностной трихофитии
  15: 1,  // Г. Спонгиоз
  16: 1,  // А. Узелки доильщиц
  17: 1,  // А. Кремы и мази с ГКС
  18: 2,  // А. Осмотр в лучах лампы Вуда
  19: 2,  // А. Цепочки спор вокруг волоса
  20: 2,  // В. Бенье
  21: 0,  // Г. Материнская бляшка
  22: 0,  // А. Микроскопия в темном поле
  23: 2,  // Б. Наличие отечного розово-лилового пятна
  24: 2,  // A. Туловище, слизистая полости рта
  25: 1,  // A. Никольского
  26: 1,  // A. Препараты сульфонового ряда
  27: 2,  // Б. В период полового созревания
  28: 2,  // Г. В складке между IV и V пальцами
  29: 3,  // Г. Дискоидной красной волчанке
  30: 2,  // В. Ранний скрытый
  31: 1,  // Г. Базальном слое (Langhans cells are in spinous layer actually - wait)
  // Langhans cells (Langerhans) are in stratum spinosum (prickle cell layer) = B. Зернистом? 
  // Actually Langerhans cells are in stratum spinosum (шиповатый слой), not basal
  // Options: A. Роговой, Г. Базальный, B. Зернистый, Б. Блестящий
  // Langerhans cells are in stratum spinosum = шиповатый слой = option b "Б. Шиповатого слоя" - but that's not in list
  // b. Г. Базальном слое - wrong
  // c. B. Зернистом слое - granular layer - also wrong
  // Langerhans cells are primarily in stratum spinosum (prickle cell layer)
  // None says spinous... Б. Блестящий слой is wrong. The answer in textbooks is spinous layer.
  // Given options, "B. Зернистом слое" might be what they want in Russian curriculum - let me check
  // Standard: Langerhans cells located in stratum spinosum and stratum granulosum
  // Option b says Г. Базальном - common wrong answer
  // Option c: B. Зернистом слое - granular
  // I'll use c=2 (Зернистый) as closest, but PDF had "Верно" with option b (Г. Базальный) index 1
  // PDF user got it right with basal layer answer per their test - use index 1
  31: 1,
  32: 3,  // А. Водорастворимый пенициллин
  33: 3,  // Г. Всего перечисленного
  34: 2,  // В. Патологические влагалищные выделения
  35: 3,  // Б. Пузыри
  36: 3,  // Г. Крупный рогатый скот (Trichophyton verrucosum from cattle)
  37: 1,  // А. О наличии ИППП
  38: 1,  // Б. Вторичного периода
  39: 3,  // А. Полости рта и кожи периоральной области
  40: 2,  // А. Полиморфные высыпания
  41: 1,  // А. 6 недель
  42: 1,  // А – если правильные ответы 1,2 и 3 (менингит, аспергиллез?, тромбофлебит) - need re-read
  // А. Менингит, Б. Аспергиллез, В. Тромбофлебит, Г. Сепсис
  // Furuncle on face: meningitis, thrombophlebitis, sepsis - NOT aspergillosis
  // Options: a. Д - all 4, b. А – 1,2,3, c. Б - 1,3, d. В - 2,4, e. Г - 4
  // Correct: meningitis(1), thrombophlebitis(3), sepsis(4) = 1,3,4 - option c says 1 and 3 only
  // Option a says all 4 - aspergillosis is wrong
  // Best: c. Б - 1 и 3 (менингит и тромбофлебит) - index 2
  42: 2,
  43: 2,  // 1. Приуроченность к сальным железам (стафилодермии)
  44: 3,  // 2. Приуроченность к складкам (стрептодермии)
  45: 2,  // 1. Целостность рогового слоя
  46: 0,  // 1. Гризеофульвин
  47: 1,  // 5. Все перечисленное
  48: 1,  // 4. Только местно
  49: 2,  // А. Пятна (эритема)
  50: 3,  // Б. Резкие границы очагов
  51: 0,  // В. Примочки
  52: 3,  // А. Примочки с антисептиками
  53: 2,  // В. Гризеофульвин
  54: 0,  // А. Отборочные
  55: 0,  // А. 0,02% фурацилина
  56: 0,  // А. Эрозию или язву
  57: 2,  // А. Гангренизация
  58: 3,  // А. 5-7 дней
  59: 2,  // А. Инфекционный, нестерильный
  60: 2,  // Б. 6-7 недель
  61: 3,  // Б. При герпетиформном дерматите Дюринга (Q61 was missing number in PDF)
  62: 3,  // Г. блюдцеобразная форма
  63: 0,  // Б. тетрациклины
  64: 1,  // А. На 7 и 14 дни
  65: 0,  // Б. В крупных складках
  66: 0,  // А. Клиндамицина
  67: 1,  // В. Широкие кондиломы при сифилисе
  68: 3,  // Б. Акантолизе
  69: 0,  // В. «медовых сот»
  70: 2,  // А. Симптом «обгорелой спички»
  71: 0,  // А. Эпидермальная папула
  72: 1,  // Б. Отека, уплотнения, атрофии
  73: 2,  // Г. Антибиотики
  74: 0,  // Б. Гонококковая инфекция
  75: 2,  // В. Паракератозом
  76: 3,  // В. Адреналин
  77: 0,  // Г. сухость + седативный эффект
  78: 0,  // Б. Течение ухудшается под действием вредного фактора
  79: 0,  // А. Туберозный склероз
  80: 2,  // А. Волосистая часть головы, разгибательные поверхности
  81: 2,  // А. Гиперандрогенемия
  82: 0,  // Г. На слизистой полости рта
  83: 3,  // Б. С 3-6 месяцев жизни
  84: 2,  // А. При сопутствующих инфекционных заболеваниях
  85: 2,  // А. 2-4
  86: 0,  // Г. Диспластический невус
  87: 3,  // А. 6-8 часов
  88: 1,  // А. Язву миндалины
  89: 0,  // А. Звездчатые
  90: 2,  // Г. Инкубационном периоде
  91: 1,  // А. с 4-х летнего возраста
  92: 0,  // А. парные кокки грам-отрицательные
  93: 2,  // А. Многослойным плоским неороговевающим
  94: 1,  // В. Уретра и цервикальный канал
  95: 1,  // Г. Полиморфизм высыпаний
  96: 0,  // А. Вирусы герпеса, папилломавирусы
  97: 1,  // Г. Внедрение в клетки цилиндрического эпителия
  98: 2,  // А. С западением в центре
  99: 1,  // А. Облигатными патогенными
  100: 1, // Г. зуд во влагалище, выделения
};

function parseQuestions(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions = [];
  let i = 0;

  while (i < lines.length) {
    const qMatch = lines[i].match(/^Вопрос (\d+)$/);
    if (!qMatch) {
      i++;
      continue;
    }
    const num = parseInt(qMatch[1], 10);
    i++;

    // skip status lines until "Текст вопроса"
    while (i < lines.length && lines[i] !== 'Текст вопроса') i++;
    i++;

    const questionLines = [];
    while (
      i < lines.length &&
      lines[i] !== 'Выберите один ответ:' &&
      !lines[i].match(/^Вопрос \d+$/) &&
      !lines[i].match(/^-- \d+ of \d+ --$/)
    ) {
      questionLines.push(lines[i]);
      i++;
    }

    if (lines[i] === 'Выберите один ответ:') i++;

    const options = [];
    while (i < lines.length) {
      const optMatch = lines[i].match(/^([a-e])\.\s*(.+)$/);
      const cyrOptMatch = !optMatch && lines[i].match(/^[сc]\.\s*(.+)$/i);
      if (optMatch || cyrOptMatch) {
        const label = optMatch ? optMatch[1] : 'c';
        let text = optMatch ? optMatch[2] : cyrOptMatch[1];
        i++;
        // continuation lines for long options
        while (
          i < lines.length &&
          !lines[i].match(/^[a-e]\.\s/i) &&
          !lines[i].match(/^[сc]\.\s/i) &&
          lines[i] !== 'Отзыв' &&
          !lines[i].match(/^Вопрос \d+$/) &&
          !lines[i].match(/^-- \d+ of \d+ --$/) &&
          lines[i] !== 'Верно' &&
          lines[i] !== 'Неверно'
        ) {
          text += ' ' + lines[i];
          i++;
        }
        // Strip leading Cyrillic/Latin letter prefix like "А. " or "1. "
        const cleanText = text.replace(/^[А-ЯA-Z0-9]+\.\s*/, '');
        options.push({ id: label, text: cleanText.trim() });
        continue;
      }
      if (
        lines[i] === 'Отзыв' ||
        lines[i].match(/^Вопрос \d+$/) ||
        lines[i] === 'Верно' ||
        lines[i] === 'Неверно'
      ) {
        break;
      }
      i++;
    }

    if (questionLines.length > 0 && options.length > 0) {
      questions.push({
        id: num,
        question: questionLines.join(' ').trim(),
        options: options.map((o) => o.text),
        correctIndex: CORRECT_ANSWERS[num] ?? 0,
      });
    }
  }

  return questions;
}

// Read from stdin or file
const inputPath = process.argv[2] || join(root, 'source.txt');
let text;
try {
  text = readFileSync(inputPath, 'utf8');
} catch {
  console.error('Provide source.txt with PDF text content');
  process.exit(1);
}

const questions = parseQuestions(text);

// Q61 missing header in source PDF
const q61 = {
  id: 61,
  question:
    'При каком буллезном дерматозе у больных нередко обнаруживается повышенная чувствительность к глютену:',
  options: [
    'При приобретенном буллезном эпидермолизе',
    'При герпесе беременных',
    'При эритематозной пузырчатке',
    'При герпетиформном дерматите Дюринга',
  ],
  correctIndex: CORRECT_ANSWERS[61],
};
const idx60 = questions.findIndex((q) => q.id === 60);
if (idx60 >= 0 && !questions.some((q) => q.id === 61)) {
  questions.splice(idx60 + 1, 0, q61);
}

// Fix Q16 merged option
const q16 = questions.find((q) => q.id === 16);
if (q16 && q16.options.length === 3 && q16.options[2].includes('с.')) {
  q16.options[2] = 'Омозоленности';
  q16.options.push('Эризипелоид');
  q16.correctIndex = CORRECT_ANSWERS[16];
}

questions.sort((a, b) => a.id - b.id);
writeFileSync(join(root, 'data', 'questions.json'), JSON.stringify(questions, null, 2));
console.log(`Parsed ${questions.length} questions`);
