#!/usr/bin/env node
/**
 * Parses GIA_test.pdf text export into questions.json
 * Correct answers are loaded from data/correct-answers.json (extracted from PDF green highlights)
 *
 * Run: npm run build:data
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadCorrectAnswers() {
  const path = join(root, 'data', 'correct-answers.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const map = {};
  for (const [id, index] of Object.entries(raw)) {
    map[Number(id)] = index;
  }
  return map;
}

function parseQuestions(text, correctAnswers) {
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
        let text = optMatch ? optMatch[2] : cyrOptMatch[1];
        i++;
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
        const cleanText = text.replace(/^[А-ЯA-Z0-9]+\.\s*/, '');
        options.push(cleanText.trim());
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
        options,
        correctIndex: correctAnswers[num] ?? 0,
      });
    }
  }

  return questions;
}

const correctAnswers = loadCorrectAnswers();
const inputPath = process.argv[2] || join(root, 'source.txt');
let text;
try {
  text = readFileSync(inputPath, 'utf8');
} catch {
  console.error('Provide source.txt with PDF text content');
  process.exit(1);
}

let questions = parseQuestions(text, correctAnswers);

// Q61 has no header in source PDF
if (!questions.some((q) => q.id === 61)) {
  const idx60 = questions.findIndex((q) => q.id === 60);
  questions.splice(idx60 + 1, 0, {
    id: 61,
    question:
      'При каком буллезном дерматозе у больных нередко обнаруживается повышенная чувствительность к глютену:',
    options: [
      'При приобретенном буллезном эпидермолизе',
      'При герпесе беременных',
      'При эритематозной пузырчатке',
      'При герпетиформном дерматите Дюринга',
    ],
    correctIndex: correctAnswers[61],
  });
}

// Q16: split merged option line in text export
const q16 = questions.find((q) => q.id === 16);
if (q16 && q16.options.length === 3 && q16.options[2].includes('с.')) {
  q16.options[2] = 'Омозоленности';
  q16.options.push('Эризипелоид');
  q16.correctIndex = correctAnswers[16];
}

questions.sort((a, b) => a.id - b.id);

const missing = questions.filter((q) => correctAnswers[q.id] === undefined);
if (missing.length) {
  console.warn('Missing correct answers for:', missing.map((q) => q.id).join(', '));
}

writeFileSync(join(root, 'data', 'questions.json'), JSON.stringify(questions, null, 2));
console.log(`Parsed ${questions.length} questions with PDF answer key`);
