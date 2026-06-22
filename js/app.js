const LETTERS = 'абвгде';
const STORAGE_KEY = 'gia-dermatology-test-v1';
const SETTINGS_KEY = 'gia-dermatology-test-settings';

let questions = [];
let order = [];
let answers = [];
let currentIndex = 0;
let showAnswers = false;
let resultsFilter = 'all';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  start: $('#screen-start'),
  quiz: $('#screen-quiz'),
  results: $('#screen-results'),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    showAnswers = Boolean(data.showAnswers);
  } catch {
    showAnswers = false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showAnswers }));
  } catch {
    /* ignore */
  }
}

function syncAnswersToggle() {
  const toggle = $('#toggle-answers');
  if (toggle) toggle.checked = showAnswers;
}

function setShowAnswers(enabled) {
  showAnswers = enabled;
  saveSettings();
  syncAnswersToggle();
  if (!screens.quiz.classList.contains('hidden')) {
    updateNav();
    renderQuestion();
  }
}

async function loadQuestions() {
  const res = await fetch('data/questions.json');
  questions = await res.json();
}

function saveProgress(screen = 'quiz') {
  try {
    const payload = {
      version: 1,
      questionCount: questions.length,
      screen,
      order,
      answers,
      currentIndex,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1 || data.questionCount !== questions.length) return null;
    if (!Array.isArray(data.order) || data.order.length !== questions.length) return null;
    if (!Array.isArray(data.answers) || data.answers.length !== questions.length) return null;
    return data;
  } catch {
    return null;
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  updateStartScreen();
}

function updateStartScreen() {
  const saved = loadProgress();
  const hint = $('#saved-progress-hint');
  const btnContinue = $('#btn-continue');
  const btnViewResults = $('#btn-view-results');
  const btnStart = $('#btn-start');

  if (!saved) {
    hint.classList.add('hidden');
    btnContinue.classList.add('hidden');
    btnViewResults.classList.add('hidden');
    btnStart.textContent = 'Начать тест';
    return;
  }

  const answered = saved.answers.filter((a) => a !== null).length;

  if (saved.screen === 'results') {
    hint.textContent = 'Последний тест завершён. Можно посмотреть результаты или начать заново.';
    hint.classList.remove('hidden');
    btnContinue.classList.add('hidden');
    btnViewResults.classList.remove('hidden');
    btnStart.textContent = 'Начать заново';
    return;
  }

  hint.textContent = `Сохранённый прогресс: отвечено ${answered} из ${questions.length} вопросов.`;
  hint.classList.remove('hidden');
  btnContinue.classList.remove('hidden');
  btnViewResults.classList.add('hidden');
  btnStart.textContent = 'Начать заново';
}

function applyProgress(data) {
  order = data.order;
  answers = data.answers;
  currentIndex = Math.min(Math.max(0, data.currentIndex ?? 0), questions.length - 1);
  resultsFilter = 'all';
}

function restoreQuiz() {
  const saved = loadProgress();
  if (!saved || saved.screen === 'results') return false;
  applyProgress(saved);
  buildNav();
  renderQuestion();
  showScreen('quiz');
  return true;
}

function restoreResults() {
  const saved = loadProgress();
  if (!saved || saved.screen !== 'results') return false;
  applyProgress(saved);
  showResults(false);
  return true;
}

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  $('#progress-bar').classList.toggle('hidden', name !== 'quiz');
  if (name === 'quiz') syncAnswersToggle();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function getStatus(answer, correctIndex) {
  if (answer === null) return 'skipped';
  if (answer === correctIndex) return 'correct';
  return 'wrong';
}

const STATUS_LABELS = {
  correct: 'Верно',
  wrong: 'Ошибка',
  skipped: 'Пропущен',
};

function initTest(shuffle = false) {
  clearProgress();
  order = questions.map((_, i) => i);
  if (shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  answers = new Array(questions.length).fill(null);
  currentIndex = 0;
  resultsFilter = 'all';
  syncAnswersToggle();
  buildNav();
  renderQuestion();
  showScreen('quiz');
  saveProgress('quiz');
}

function buildNav() {
  const nav = $('#question-nav');
  nav.innerHTML = '';
  order.forEach((qIdx, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-dot';
    btn.textContent = questions[qIdx].id;
    btn.title = `Вопрос ${questions[qIdx].id}`;
    btn.addEventListener('click', () => {
      currentIndex = i;
      renderQuestion();
      btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
    nav.appendChild(btn);
  });
}

function updateNav() {
  const dots = $('#question-nav').children;
  for (let i = 0; i < dots.length; i++) {
    const qIdx = order[i];
    const answer = answers[qIdx];
    dots[i].className = 'nav-dot';

    if (showAnswers && answer !== null) {
      const status = getStatus(answer, questions[qIdx].correctIndex);
      dots[i].classList.add(`nav-dot--${status}`);
    } else if (answer !== null) {
      dots[i].classList.add('nav-dot--answered');
    }

    if (i === currentIndex) {
      dots[i].classList.add('nav-dot--active');
      dots[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }
}

function updateProgress() {
  const answered = answers.filter((a) => a !== null).length;
  const pct = Math.round((answered / questions.length) * 100);
  $('#progress-fill').style.width = `${pct}%`;
  $('#progress-text').textContent = `${answered} / ${questions.length}`;
  $('#progress-bar').setAttribute('aria-valuenow', String(pct));
}

function renderQuestion() {
  const qIdx = order[currentIndex];
  const q = questions[qIdx];
  const selected = answers[qIdx];

  $('#question-number').textContent = `Вопрос ${q.id}`;
  $('#question-text').textContent = q.question;
  $('#question-status').textContent = `${currentIndex + 1} из ${questions.length}`;

  const fieldset = $('#options');
  fieldset.innerHTML = '';

  q.options.forEach((text, i) => {
    const label = document.createElement('label');
    label.className = 'option';
    if (selected === i) label.classList.add('option--selected');

    if (showAnswers && selected !== null) {
      if (i === q.correctIndex) label.classList.add('option--correct');
      if (selected === i && i !== q.correctIndex) label.classList.add('option--wrong');
    }

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(i);
    input.checked = selected === i;
    input.addEventListener('change', () => {
      answers[qIdx] = i;
      renderQuestion();
    });

    const span = document.createElement('span');
    span.className = 'option__label';
    span.textContent = `${LETTERS[i] ?? i + 1}) ${text}`;

    label.appendChild(input);
    label.appendChild(span);
    fieldset.appendChild(label);
  });

  $('#btn-prev').disabled = currentIndex === 0;
  $('#btn-next').classList.toggle('hidden', currentIndex === questions.length - 1);
  $('#btn-finish').classList.toggle('hidden', currentIndex !== questions.length - 1);

  updateNav();
  updateProgress();
  saveProgress('quiz');
}

function buildResultsMap() {
  const map = $('#results-map');
  map.innerHTML = '';

  questions.forEach((q, i) => {
    const status = getStatus(answers[i], q.correctIndex);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `map-cell map-cell--${status}`;
    btn.textContent = q.id;
    btn.title = `${STATUS_LABELS[status]}: вопрос ${q.id}`;
    btn.setAttribute('role', 'listitem');
    btn.addEventListener('click', () => {
      setActiveFilter('all');
      renderResultsBreakdown('all');
      const el = document.getElementById(`result-q-${q.id}`);
      if (el) {
        el.classList.add('result-item--highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => el.classList.remove('result-item--highlight'), 2000);
      }
    });
    map.appendChild(btn);
  });
}

function setActiveFilter(filter) {
  resultsFilter = filter;
  $$('.filter-btn').forEach((btn) => {
    btn.classList.toggle('filter-btn--active', btn.dataset.filter === filter);
  });
}

function renderResultsBreakdown(filter = resultsFilter) {
  const list = $('#results-breakdown');
  list.innerHTML = '';

  const sorted = questions
    .map((q, i) => ({ q, i, status: getStatus(answers[i], q.correctIndex) }))
    .filter(({ status }) => filter === 'all' || status === filter);

  if (!sorted.length) {
    list.innerHTML = `<p class="breakdown-empty">Нет вопросов в этой категории</p>`;
    return;
  }

  sorted.forEach(({ q, i, status }) => {
    const a = answers[i];
    const item = document.createElement('article');
    item.className = `result-item result-item--${status}`;
    item.id = `result-q-${q.id}`;

    let details = '';
    if (status === 'wrong') {
      details = `
        <p class="result-item__line">Ваш ответ: ${escapeHtml(q.options[a])}</p>
        <p class="result-item__line">Правильно: <strong>${escapeHtml(q.options[q.correctIndex])}</strong></p>
      `;
    } else if (status === 'skipped') {
      details = `
        <p class="result-item__line result-item__line--muted">Ответ не выбран</p>
        <p class="result-item__line">Правильно: <strong>${escapeHtml(q.options[q.correctIndex])}</strong></p>
      `;
    } else {
      details = `<p class="result-item__line">Ответ: <strong>${escapeHtml(q.options[q.correctIndex])}</strong></p>`;
    }

    item.innerHTML = `
      <div class="result-item__header">
        <span class="result-item__num">Вопрос ${q.id}</span>
        <span class="result-item__badge result-item__badge--${status}">${STATUS_LABELS[status]}</span>
      </div>
      <p class="result-item__question">${escapeHtml(q.question)}</p>
      ${details}
    `;
    list.appendChild(item);
  });
}

function showResults(persist = true) {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  questions.forEach((q, i) => {
    const status = getStatus(answers[i], q.correctIndex);
    if (status === 'correct') correct++;
    else if (status === 'wrong') wrong++;
    else skipped++;
  });

  const percent = Math.round((correct / questions.length) * 100);

  $('#score-percent').textContent = `${percent}%`;
  $('#score-circle').style.background = `conic-gradient(var(--accent) ${percent}%, var(--surface-2) ${percent}%)`;

  let title = 'Отличный результат!';
  if (percent < 60) title = 'Нужно повторить материал';
  else if (percent < 80) title = 'Хороший результат';
  else if (percent < 90) title = 'Очень хорошо!';

  $('#score-title').textContent = title;
  $('#score-summary').textContent = `${percent}% верных — ${correct} из ${questions.length} вопросов.`;
  $('#stat-correct').textContent = correct;
  $('#stat-wrong').textContent = wrong;
  $('#stat-skipped').textContent = skipped;

  resultsFilter = 'all';
  setActiveFilter('all');
  buildResultsMap();
  renderResultsBreakdown('all');
  showScreen('results');
  if (persist) saveProgress('results');
}

function finishTest() {
  showResults(true);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

$('#btn-continue').addEventListener('click', () => restoreQuiz());
$('#btn-view-results').addEventListener('click', () => restoreResults());
$('#toggle-answers').addEventListener('change', (e) => setShowAnswers(e.target.checked));
$('#btn-start').addEventListener('click', () => initTest(false));
$('#btn-shuffle').addEventListener('click', () => initTest(true));
$('#btn-prev').addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
});
$('#btn-next').addEventListener('click', () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
});
$('#btn-finish').addEventListener('click', finishTest);
$('#btn-retry').addEventListener('click', () => {
  clearProgress();
  showScreen('start');
});

$$('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setActiveFilter(btn.dataset.filter);
    renderResultsBreakdown(btn.dataset.filter);
  });
});

loadQuestions()
  .then(() => {
    loadSettings();
    syncAnswersToggle();
    updateStartScreen();
    const saved = loadProgress();
    if (saved?.screen === 'quiz') {
      restoreQuiz();
    }
  })
  .catch(() => {
    document.body.innerHTML =
      '<p style="padding:2rem;text-align:center">Не удалось загрузить вопросы.</p>';
  });
