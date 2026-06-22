const LETTERS = 'абвгде';

let questions = [];
let order = [];
let answers = [];
let currentIndex = 0;
let reviewMode = false;

const $ = (sel) => document.querySelector(sel);

const screens = {
  start: $('#screen-start'),
  quiz: $('#screen-quiz'),
  results: $('#screen-results'),
};

async function loadQuestions() {
  const res = await fetch('data/questions.json');
  questions = await res.json();
}

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  $('#progress-bar').classList.toggle('hidden', name !== 'quiz');
}

function initTest(shuffle = false) {
  order = questions.map((_, i) => i);
  if (shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  answers = new Array(questions.length).fill(null);
  currentIndex = 0;
  reviewMode = false;
  buildNav();
  renderQuestion();
  showScreen('quiz');
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
    });
    nav.appendChild(btn);
  });
}

function updateNav() {
  const dots = $('#question-nav').children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = 'nav-dot';
    if (answers[order[i]] !== null) dots[i].classList.add('nav-dot--answered');
    if (i === currentIndex) dots[i].classList.add('nav-dot--active');
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

  const status = $('#question-status');
  status.textContent = `${currentIndex + 1} из ${questions.length}`;

  const fieldset = $('#options');
  fieldset.innerHTML = '';
  fieldset.disabled = reviewMode;

  q.options.forEach((text, i) => {
    const label = document.createElement('label');
    label.className = 'option';
    if (selected === i) label.classList.add('option--selected');

    if (reviewMode) {
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
}

function finishTest() {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  questions.forEach((q, i) => {
    const a = answers[i];
    if (a === null) skipped++;
    else if (a === q.correctIndex) correct++;
    else wrong++;
  });

  const percent = Math.round((correct / questions.length) * 100);

  $('#score-percent').textContent = `${percent}%`;
  $('#score-circle').style.background = `conic-gradient(var(--accent) ${percent}%, var(--surface-2) ${percent}%)`;

  let title = 'Отличный результат!';
  if (percent < 60) title = 'Нужно повторить материал';
  else if (percent < 80) title = 'Хороший результат';
  else if (percent < 90) title = 'Очень хорошо!';

  $('#score-title').textContent = title;
  $('#score-summary').textContent = `${percent}% верных ответов — ${correct} из ${questions.length} вопросов.`;
  $('#stat-correct').textContent = correct;
  $('#stat-wrong').textContent = wrong;
  $('#stat-skipped').textContent = skipped;

  $('#review-list').classList.add('hidden');
  $('#review-list').innerHTML = '';
  showScreen('results');
}

function showReview() {
  const list = $('#review-list');
  list.innerHTML = '';
  list.classList.remove('hidden');

  questions.forEach((q, i) => {
    const a = answers[i];
    if (a === null || a === q.correctIndex) return;

    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <div class="review-item__header">
        <span class="review-item__num">Вопрос ${q.id}</span>
        <span class="review-item__badge review-item__badge--wrong">Ошибка</span>
      </div>
      <p class="review-item__question">${escapeHtml(q.question)}</p>
      <p class="review-item__answer">Ваш ответ: ${escapeHtml(q.options[a])}</p>
      <p class="review-item__answer">Правильно: <strong>${escapeHtml(q.options[q.correctIndex])}</strong></p>
    `;
    list.appendChild(item);
  });

  if (!list.children.length) {
    list.innerHTML = '<p class="card__lead" style="text-align:center">Ошибок нет — молодец!</p>';
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
$('#btn-retry').addEventListener('click', () => showScreen('start'));
$('#btn-review').addEventListener('click', showReview);

loadQuestions().catch(() => {
  document.body.innerHTML =
    '<p style="padding:2rem;text-align:center">Не удалось загрузить вопросы. Откройте сайт через HTTP-сервер или GitHub Pages.</p>';
});
