// Рейтинг пользователя по его email

// =============================================
//   ТЕГ-ИНПУТ ДЛЯ СПЕЦИАЛИЗАЦИЙ
// =============================================

// Инициализирует тег-инпут в контейнере
// wrapId   — id обёртки (div.tags-input-wrap)
// inputId  — id <input class="tags-input-field">
// hiddenId — id <input type="hidden"> куда пишется итоговая строка "tag1,tag2"
// initialTags — начальный массив тегов (при редактировании)
function initTagInput(wrapId, inputId, hiddenId, initialTags = []) {
  const wrap   = document.getElementById(wrapId);
  const field  = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  if (!wrap || !field || !hidden) return;

  let tags = [...initialTags];

  function sync() {
    hidden.value = tags.join(',');
  }

  function renderTags() {
    // Удаляем старые чипы
    wrap.querySelectorAll('.spec-tag-chip').forEach(c => c.remove());
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'spec-tag-chip';
      chip.innerHTML = `${tag} <button type="button" aria-label="Удалить">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        tags.splice(i, 1);
        renderTags();
        sync();
      });
      wrap.insertBefore(chip, field);
    });
    sync();
  }

  function addTag(raw) {
    const values = raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    values.forEach(val => {
      if (val && !tags.includes(val)) tags.push(val);
    });
    field.value = '';
    renderTags();
  }

  field.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field.value);
    } else if (e.key === 'Backspace' && !field.value && tags.length) {
      tags.pop();
      renderTags();
    }
  });

  field.addEventListener('blur', () => {
    if (field.value.trim()) addTag(field.value);
  });

  // Клик по обёртке фокусирует инпут
  wrap.addEventListener('click', () => field.focus());

  renderTags();

  // Возвращаем геттер тегов
  return { getTags: () => tags, setTags: (t) => { tags = [...t]; renderTags(); } };
}

// Реестр тег-инпутов чтобы читать значения при сабмите
const tagInputs = {};

// =============================================
//   InterviewHub — script.js
// =============================================

// ---------- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ----------
const state = {
  currentUser: null,       // { name, email, role, spec?, exp?, bio? }
  selectedRole: null,      // 'candidate' | 'interviewer'
  modalMode: 'role',       // 'role' | 'register' | 'login'
};

// ---------- ДЕМО-ДАННЫЕ ИНТЕРВЬЮЕРОВ ----------
const MOCK_INTERVIEWERS = [
  {
    name: 'Алексей Петров',
    spec: 'Senior Frontend Engineer',
    tags: ['React', 'TypeScript', 'CSS'],
    bio: 'Работаю в Яндексе 6 лет. Помогу подготовиться к техническому интервью в топ-компании.',
    exp: 6,
    emoji: '💻',
  },
  {
    name: 'Марина Соколова',
    spec: 'Staff Backend Engineer',
    tags: ['Python', 'Go', 'System Design'],
    bio: 'Провела 200+ интервью в качестве нанимающего менеджера. Знаю, что ищут компании.',
    exp: 9,
    emoji: '🧠',
  },
  {
    name: 'Дмитрий Орлов',
    spec: 'ML Engineer',
    tags: ['ML', 'PyTorch', 'LLMs'],
    bio: 'Специализируюсь на ML-интервью для DS и MLE позиций. Делаю разборы задач на кодинг.',
    exp: 5,
    emoji: '🤖',
  },
  {
    name: 'Ольга Новикова',
    spec: 'Product Manager',
    tags: ['Product', 'Roadmap', 'OKR'],
    bio: 'Помогу подготовиться к PM-интервью: продуктовые кейсы, аналитика, стратегия.',
    exp: 7,
    emoji: '📊',
  },
  {
    name: 'Иван Смирнов',
    spec: 'DevOps / SRE',
    tags: ['Kubernetes', 'AWS', 'CI/CD'],
    bio: 'Опыт в DevOps и SRE с фокусом на надёжность систем. Готовлю к системным интервью.',
    exp: 8,
    emoji: '⚙️',
  },
  {
    name: 'Кira Захарова',
    spec: 'iOS / Android Developer',
    tags: ['Swift', 'Kotlin', 'Mobile'],
    bio: 'Разработчик мобильных приложений в VK. Помогу с алгоритмами и платформенными вопросами.',
    exp: 4,
    emoji: '📱',
  },
];

// ---------- УТИЛИТЫ ----------
function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'default') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function validate(fields) {
  for (const [value, msg] of fields) {
    if (!value || !value.trim()) { showToast(msg, 'error'); return false; }
  }
  return true;
}

// ---------- СОСТОЯНИЕ ФИЛЬТРОВ ----------
const filters = {
  query: '',
  spec: 'all',
  sort: 'default',
};

// Маппинг чипов → ключевые слова для поиска
const SPEC_KEYWORDS = {
  frontend: ['frontend', 'react', 'vue', 'angular', 'css', 'javascript', 'typescript', 'html'],
  backend:  ['backend', 'python', 'go', 'java', 'node', 'api', 'sql', 'django', 'spring'],
  ml:       ['ml', 'ai', 'machine learning', 'pytorch', 'tensorflow', 'llm', 'data science', 'ds', 'mle'],
  mobile:   ['mobile', 'ios', 'android', 'swift', 'kotlin', 'flutter', 'react native'],
  devops:   ['devops', 'sre', 'kubernetes', 'docker', 'aws', 'ci/cd', 'linux', 'terraform'],
  product:  ['product', 'pm', 'manager', 'roadmap', 'okr', 'аналитик'],
};

function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="highlight">$1</span>');
}

function getAllInterviewers() {
  return [...MOCK_INTERVIEWERS, ...getStoredInterviewers()];
}

function applyFilters() {
  let list = getAllInterviewers();
  const q = filters.query.toLowerCase().trim();

  // Фильтр по тексту
  if (q) {
    list = list.filter(iv => {
      const haystack = [iv.name, iv.spec, iv.bio, ...(iv.tags || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // Фильтр по специализации
  if (filters.spec !== 'all') {
    const kw = SPEC_KEYWORDS[filters.spec] || [];
    list = list.filter(iv => {
      const haystack = [iv.spec, ...(iv.tags || [])].join(' ').toLowerCase();
      return kw.some(k => haystack.includes(k));
    });
  }

  // Сортировка
  if (filters.sort === 'exp_desc') list.sort((a, b) => b.exp - a.exp);
  else if (filters.sort === 'exp_asc') list.sort((a, b) => a.exp - b.exp);
  else if (filters.sort === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return list;
}

function renderInterviewers() {
  const listEl   = $('interviewersList');
  const emptyEl  = $('emptyState');
  const countEl  = $('resultsCount');
  const resetBtn = $('resetFilters');

  const results = applyFilters();
  const q = filters.query.trim();
  const isFiltered = q || filters.spec !== 'all' || filters.sort !== 'default';

  listEl.innerHTML = '';

  // Пустое состояние
  if (results.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  } else {
    listEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
  }

  // Счётчик
  if (isFiltered) {
    countEl.innerHTML = `Найдено: <strong>${results.length}</strong> из ${getAllInterviewers().length}`;
    resetBtn.classList.remove('hidden');
  } else {
    countEl.innerHTML = `Всего интервьюеров: <strong>${results.length}</strong>`;
    resetBtn.classList.add('hidden');
  }

  // Рендер карточек
  results.forEach((iv, i) => {
    const card = document.createElement('div');
    card.className = 'interviewer-card';
    card.style.animationDelay = `${i * 0.06}s`;

    const name = highlight(iv.name, q);
    const spec = highlight(iv.spec, q);
    const bio  = highlight(iv.bio,  q);

    card.innerHTML = `
      <div class="card-header">
        <div class="avatar avatar-initials">${iv.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div>
          <div class="card-name">${name}</div>
          ${(iv.tags && iv.tags.length > 0) ? '' : `<div class="card-spec">${spec}</div>`}
        </div>
      </div>
      <div class="card-tags">
        ${(iv.tags || []).map(t => `<span class="tag">${highlight(t, q)}</span>`).join('')}
      </div>
      <div class="card-bio">${bio}</div>
      <div class="card-footer">
        <div class="card-exp">Опыт: <strong>${iv.exp} ${expLabel(iv.exp)}</strong></div>
        <div style="display:flex;gap:8px;">
          <button class="btn-card btn-card-msg" onclick="openDirectChat('${iv.name.replace(/'/g, "\\'")}')">💬 Написать</button>
          <button class="btn-card" onclick="handleBooking('${iv.name.replace(/'/g, "\\'")}')">Записаться</button>
        </div>
      </div>
    `;
    listEl.appendChild(card);
  });
}

function expLabel(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'год';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'года';
  return 'лет';
}

function resetAllFilters() {
  filters.query = '';
  filters.spec  = 'all';
  filters.sort  = 'default';
  $('searchInput').value = '';
  $('sortSelect').value  = 'default';
  $('searchClear').classList.add('hidden');
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.spec === 'all');
  });
  renderInterviewers();
}

function handleBooking(interviewerName) {
  if (!state.currentUser) {
    showToast('Войди или зарегистрируйся, чтобы записаться', 'error');
    openModal('login');
    return;
  }
  // Нельзя подавать заявку себе
  if (state.currentUser.name === interviewerName) {
    showToast('Нельзя записаться на интервью к себе 😄', 'error');
    return;
  }
  // Проверяем: уже подавал заявку?
  const apps = getApplications();
  const exists = apps.find(a =>
    a.candidateEmail === state.currentUser.email &&
    a.interviewerName === interviewerName &&
    a.status === 'pending'
  );
  if (exists) {
    showToast('Ты уже отправил заявку этому интервьюеру', 'error');
    return;
  }

  const app = {
    id:              'app_' + Date.now(),
    candidateEmail:  state.currentUser.email,
    candidateName:   state.currentUser.name,
    interviewerName: interviewerName,
    status:          'pending',   // pending | accepted | rejected
    createdAt:       new Date().toISOString(),
    messages:        [],
  };
  saveApplication(app);
  renderMyMeetings();
  showToast(`Заявка отправлена ${interviewerName}! 🎉`, 'success');
}

// ---------- ХРАНИЛИЩЕ (localStorage) ----------
function getUsers() {
  return JSON.parse(localStorage.getItem('ih_users') || '[]');
}

function saveUser(user) {
  const users = getUsers();
  users.push(user);
  localStorage.setItem('ih_users', JSON.stringify(users));
}

function getStoredInterviewers() {
  return getUsers()
    .filter(u => {
      // Поддерживаем и старый формат (role: string) и новый (roles: array)
      if (Array.isArray(u.roles)) return u.roles.includes('interviewer');
      return u.role === 'interviewer';
    })
    .map(u => ({
      name: u.name,
      spec: u.spec || 'Интервьюер',
      tags: (u.spec || '').split(',').map(s => s.trim()).filter(Boolean),
      bio: u.bio || 'Готов помочь тебе подготовиться к интервью.',
      exp: parseInt(u.exp) || 1,
      emoji: '👤',
    }));
}

// ---------- ЗАЯВКИ ----------
function getApplications() {
  return JSON.parse(localStorage.getItem('ih_apps') || '[]');
}
function saveApplication(app) {
  const apps = getApplications();
  const idx = apps.findIndex(a => a.id === app.id);
  if (idx >= 0) apps[idx] = app;
  else apps.push(app);
  localStorage.setItem('ih_apps', JSON.stringify(apps));
}
function updateAppStatus(id, status) {
  const apps = getApplications();
  const app = apps.find(a => a.id === id);
  if (app) { app.status = status; localStorage.setItem('ih_apps', JSON.stringify(apps)); }
  return app;
}
function getAppById(id) {
  return getApplications().find(a => a.id === id);
}

// ---------- СООБЩЕНИЯ ----------
function getChatKey(appId) { return `ih_chat_${appId}`; }
function getMessages(appId) {
  return JSON.parse(localStorage.getItem(getChatKey(appId)) || '[]');
}
function addMessage(appId, msg) {
  const msgs = getMessages(appId);
  msgs.push(msg);
  localStorage.setItem(getChatKey(appId), JSON.stringify(msgs));
}

function setCurrentUser(user) {
  state.currentUser = user;
  localStorage.setItem('ih_current', JSON.stringify(user));
  updateNavForUser(user);
}

function loadCurrentUser() {
  const stored = localStorage.getItem('ih_current');
  if (stored) {
    state.currentUser = JSON.parse(stored);
    updateNavForUser(state.currentUser);
  }
}

// Контент hero и шагов — отдельно для каждой роли
const HERO_CONTENT = {
  candidate: {
    badge:    '🎯 Для кандидатов',
    title:    'Подготовься к<br/><span class="gradient-text">интервью мечты</span>',
    sub:      'Найди опытного интервьюера из индустрии, пройди практику — и получи оффер.',
    stats:    `<div class="stat"><strong>120+</strong><span>Интервьюеров</span></div>
               <div class="stat-divider"></div>
               <div class="stat"><strong>840+</strong><span>Сессий</span></div>
               <div class="stat-divider"></div>
               <div class="stat"><strong>94%</strong><span>Довольных</span></div>`,
    steps: [
      { n:'01', h:'Найди интервьюера', p:'Фильтруй по специализации, опыту и стеку — выбери того, кто подходит именно тебе.' },
      { n:'02', h:'Запишись на сессию', p:'Отправь заявку и обсуди удобное время прямо в чате с интервьюером.' },
      { n:'03', h:'Получи фидбэк', p:'Пройди мок-интервью, узнай свои слабые места и иди за оффером уверенно.' },
    ],
  },
  interviewer: {
    badge:    '🧑‍💼 Для интервьюеров',
    title:    'Делись опытом<br/><span class="gradient-text">и зарабатывай</span>',
    sub:      'Помогай кандидатам расти, проводи мок-интервью и строй репутацию эксперта в индустрии.',
    stats:    `<div class="stat"><strong>500+</strong><span>Кандидатов</span></div>
               <div class="stat-divider"></div>
               <div class="stat"><strong>840+</strong><span>Сессий</span></div>
               <div class="stat-divider"></div>
               <div class="stat"><strong>4.9 ★</strong><span>Средний рейтинг</span></div>`,
    steps: [
      { n:'01', h:'Создай профиль', p:'Заполни специализацию, опыт и расскажи чем можешь помочь — кандидаты сами найдут тебя.' },
      { n:'02', h:'Принимай заявки', p:'Просматривай входящие заявки, принимай подходящих кандидатов и договаривайся о времени в чате.' },
      { n:'03', h:'Проводи интервью', p:'Делись знаниями, давай честный фидбэк и собирай отзывы — строй репутацию эксперта.' },
    ],
  },
};

function updateHeroForRole(role) {
  const c = HERO_CONTENT[role] || HERO_CONTENT.candidate;

  const badge = document.getElementById('heroBadge');
  const title = document.getElementById('heroTitle');
  const sub   = document.getElementById('heroSub');
  const stats = document.getElementById('heroStats');
  const howT  = document.getElementById('howTitle');
  const steps = document.getElementById('stepsGrid');

  if (badge) badge.textContent = c.badge.replace(/^.{2}/, '').trim(), badge.innerHTML = c.badge;
  if (title) { title.innerHTML = c.title; title.style.animation = 'fadeUp .5s ease both'; }
  if (sub)   { sub.textContent = c.sub;   sub.style.animation   = 'fadeUp .5s .1s ease both'; }
  if (stats) stats.innerHTML = c.stats;
  if (howT)  howT.textContent = role === 'interviewer' ? 'Как начать зарабатывать' : 'Как это работает';
  if (steps) {
    steps.innerHTML = c.steps.map(s => `
      <div class="step-card">
        <div class="step-num">${s.n}</div>
        <h3>${s.h}</h3>
        <p>${s.p}</p>
      </div>`).join('');
    steps.style.animation = 'fadeUp .4s .2s ease both';
  }
}

function updateNavForUser(user) {
  // Навбар: имя + кнопка профиля + выйти
  const auth = document.querySelector('.nav-auth');
  auth.innerHTML = `
    <button class="btn-profile" id="profileBtn">
      <span class="btn-profile-dot"></span>
      ${user.name.split(' ')[0]}
    </button>
    <button class="btn-ghost" id="logoutBtn">Выйти</button>
  `;
  $('logoutBtn').addEventListener('click', logout);
  $('profileBtn').addEventListener('click', openProfileSidebar);
  showApplicationsSection();

  // Меняем контент hero под роль
  updateHeroForRole(user.role);

  // Кнопки hero — заменяем на приветствие с профилем
  const heroActions = document.querySelector('.hero-actions');
  if (heroActions) {
    heroActions.innerHTML = `
      <div class="hero-logged-in" onclick="openProfileSidebar()">
        <p class="hero-logged-role">${user.role === 'interviewer' ? '🧑‍💼 Интервьюер' : '🎯 Кандидат'}</p>
        <p class="hero-logged-name">${user.name}</p>
        <p class="hero-logged-link">Открыть профиль →</p>
      </div>
    `;
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('ih_current');
  location.reload();
}

// ---------- МОДАЛЬНОЕ ОКНО ----------
const overlay = $('modalOverlay');

function openModal(mode = 'role') {
  overlay.classList.add('open');
  showScreen(mode);
}

function closeModal() {
  overlay.classList.remove('open');
  // Сброс полей
  ['regName','regEmail','regPassword','regSpec','regExp','regBio',
   'loginEmail','loginPassword'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  state.selectedRole = null;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
}

function showScreen(name) {
  document.querySelectorAll('.modal-screen').forEach(s => s.classList.add('hidden'));
  $('screen' + name.charAt(0).toUpperCase() + name.slice(1)).classList.remove('hidden');
}

// ---------- РЕГИСТРАЦИЯ ----------
function handleRegister() {
  const name     = $('regName').value;
  const email    = $('regEmail').value;
  const password = $('regPassword').value;

  if (!validate([
    [name,     'Введи своё имя'],
    [email,    'Введи email'],
    [password, 'Введи пароль'],
  ])) return;

  if (password.length < 8) { showToast('Пароль минимум 8 символов', 'error'); return; }

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    showToast('Этот email уже зарегистрирован', 'error'); return;
  }

  const user = {
    name, email, password,
    role: state.selectedRole,
    spec: $('regSpec')?.value || '',
    exp:  $('regExp')?.value  || '',
    bio:  $('regBio')?.value  || '',
    createdAt: new Date().toISOString(),
  };

  saveUser(user);
  setCurrentUser(user);
  renderInterviewers(); // обновить список, если новый интервьюер

  // Экран успеха
  $('successTitle').textContent = 'Добро пожаловать! 🎉';
  $('successText').textContent  = state.selectedRole === 'interviewer'
    ? `Твой профиль интервьюера создан, ${name.split(' ')[0]}! Теперь кандидаты смогут найти тебя.`
    : `Аккаунт создан, ${name.split(' ')[0]}! Найди подходящего интервьюера и запишись на сессию.`;
  showScreen('success');
}

// ---------- ВХОД ----------
function handleLogin() {
  const email    = $('loginEmail').value;
  const password = $('loginPassword').value;

  if (!validate([
    [email,    'Введи email'],
    [password, 'Введи пароль'],
  ])) return;

  const user = getUsers().find(u => u.email === email && u.password === password);
  if (!user) { showToast('Неверный email или пароль', 'error'); return; }

  setCurrentUser(user);
  $('successTitle').textContent = `С возвращением, ${user.name.split(' ')[0]}!`;
  $('successText').textContent  = 'Ты успешно вошёл в аккаунт.';
  showScreen('success');
}

// ---------- СОБЫТИЯ ----------
// Открытие модалки — только если не залогинен
$('loginBtn').addEventListener('click', () => {
  if (state.currentUser) return;
  openModal('login');
});
$('registerBtn').addEventListener('click', () => {
  if (state.currentUser) return;
  openModal('role');
});
$('heroCandidateBtn')?.addEventListener('click', () => {
  if (state.currentUser) return;
  state.selectedRole = 'candidate';
  openModal('register');
  $('registerRoleLabel').textContent = 'Регистрация как кандидат';
  $('interviewerFields').classList.add('hidden');
});
$('heroInterviewerBtn')?.addEventListener('click', () => {
  if (state.currentUser) return;
  state.selectedRole = 'interviewer';
  openModal('register');
  $('registerRoleLabel').textContent = 'Регистрация как интервьюер';
  $('interviewerFields').classList.remove('hidden');
});

// Выбор роли в модалке
document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.selectedRole = card.dataset.role;

    setTimeout(() => {
      showScreen('register');
      $('registerRoleLabel').textContent = state.selectedRole === 'interviewer'
        ? 'Регистрация как интервьюер' : 'Регистрация как кандидат';
      const ifFields = $('interviewerFields');
      if (state.selectedRole === 'interviewer') {
        ifFields.classList.remove('hidden');
        setTimeout(() => {
          tagInputs.reg = initTagInput('regSpecWrap','regSpecInput','regSpec',[]);
        }, 50);
      } else {
        ifFields.classList.add('hidden');
      }
    }, 200);
  });
});

// Назад
$('backToRole').addEventListener('click', () => showScreen('role'));

// Переключение логин ↔ регистрация
$('goToLogin').addEventListener('click', (e) => { e.preventDefault(); showScreen('login'); });
$('goToRegister').addEventListener('click', (e) => { e.preventDefault(); showScreen('role'); });

// Сабмит форм
$('submitRegister').addEventListener('click', handleRegister);
$('submitLogin').addEventListener('click', handleLogin);
$('successClose').addEventListener('click', () => {
  closeModal();
  if (state.currentUser?.role === 'candidate') {
    document.querySelector('#interviewers')?.scrollIntoView({ behavior: 'smooth' });
  }
});

// Закрытие
$('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

// Enter в полях
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginVisible  = !$('screenLogin').classList.contains('hidden');
  const regVisible    = !$('screenRegister').classList.contains('hidden');
  if (loginVisible)  handleLogin();
  if (regVisible)    handleRegister();
});

// ---------- СОБЫТИЯ ПОИСКА И ФИЛЬТРОВ ----------
$('searchInput').addEventListener('input', (e) => {
  filters.query = e.target.value;
  $('searchClear').classList.toggle('hidden', !e.target.value);
  renderInterviewers();
});

$('searchClear').addEventListener('click', () => {
  filters.query = '';
  $('searchInput').value = '';
  $('searchClear').classList.add('hidden');
  $('searchInput').focus();
  renderInterviewers();
});

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filters.spec = chip.dataset.spec;
    renderInterviewers();
  });
});

$('sortSelect').addEventListener('change', (e) => {
  filters.sort = e.target.value;
  renderInterviewers();
});

$('resetFilters').addEventListener('click', resetAllFilters);
$('emptyReset').addEventListener('click', resetAllFilters);


// =============================================
//   SIDEBAR ПРОФИЛЯ
// =============================================

// Демо-данные для истории (подмешиваются к реальным)
const DEMO_INTERVIEWS_INTERVIEWER = [
  { name: 'Анна К.', date: '28 мая 2025', status: 'done',     emoji: '🎯' },
  { name: 'Роман Д.', date: '14 мая 2025', status: 'done',     emoji: '🎯' },
  { name: 'Юля М.',   date: '3 июня 2025', status: 'upcoming', emoji: '📅' },
];
const DEMO_INTERVIEWS_CANDIDATE = [
  { name: 'Алексей Петров',  date: '20 мая 2025',  status: 'done',     emoji: '💻' },
  { name: 'Марина Соколова', date: '5 июня 2025',  status: 'upcoming', emoji: '📅' },
];
const DEMO_REVIEWS_INTERVIEWER = [
  { author: 'Анна К.',  stars: 5, text: 'Отличное интервью! Очень чёткая обратная связь, сразу понятно над чем работать.' },
  { author: 'Роман Д.', stars: 4, text: 'Полезная сессия, много практических советов по алгоритмам.' },
];
const DEMO_REVIEWS_CANDIDATE = [
  { author: 'Алексей Петров', stars: 5, text: 'Очень внимательный кандидат, хорошо подготовился.' },
];

function openProfileSidebar() {
  if (!state.currentUser) return;
  renderSidebar(state.currentUser);
  document.getElementById('profileSidebar').classList.add('open');
  document.getElementById('profileBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfileSidebar() {
  document.getElementById('profileSidebar').classList.remove('open');
  document.getElementById('profileBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

function starsHtml(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function renderSidebar(user) {
  const body = document.getElementById('sidebarBody');
  const isInterviewer = user.role === 'interviewer';

  // Данные из хранилища
  const userData = getUsers().find(u => u.email === user.email) || user;

  // Реальные заявки из localStorage
  const allApps = getApplications();
  const myApps  = isInterviewer
    ? allApps.filter(a => a.interviewerName === user.name)
    : allApps.filter(a => a.candidateEmail  === user.email);

  const interviews = myApps
    .filter(a => a.status === 'accepted' || a.status === 'completed')
    .map(a => ({
      id:     a.id,
      name:   isInterviewer ? a.candidateName : a.interviewerName,
      date:   fmtDate(a.createdAt),
      status: a.status === 'completed' ? 'done' : 'upcoming',
      appStatus: a.status,
    }));

  // Отзывы из localStorage
  const reviews = getReviews().filter(r => r.aboutEmail === user.email);

  const doneCount     = interviews.filter(i => i.status === 'done').length;
  const upcomingCount = interviews.filter(i => i.status === 'upcoming').length;
  const avgRating     = reviews.length
    ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1)
    : '—';

  // Блок идентификации + смена роли
  const identityBlock = `
    <div class="sb-card">
      <div class="sb-identity">
        <div class="sb-avatar">${isInterviewer ? '🧑‍💼' : '🎯'}</div>
        <div style="flex:1;">
          <div class="sb-name">${user.name}</div>
          <div class="sb-role-badge">${isInterviewer ? 'Интервьюер' : 'Кандидат'}</div>
          ${isInterviewer && userData.spec ? `<div style="font-size:13px;color:var(--text-muted);margin-top:6px;">${userData.spec}</div>` : ''}
        </div>
      </div>
      <button class="switch-role-btn" onclick="switchRole()">
        🔄 Стать ${isInterviewer ? 'кандидатом' : 'интервьюером'}
      </button>
    </div>`;

  // Статистика
  const statsBlock = `
    <div>
      <div class="sb-card-title">Статистика</div>
      <div class="sb-stats">
        <div class="sb-stat">
          <div class="sb-stat-val">${doneCount}</div>
          <div class="sb-stat-label">${isInterviewer ? 'Проведено' : 'Пройдено'}</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val">${upcomingCount}</div>
          <div class="sb-stat-label">Запланировано</div>
        </div>
        <div class="sb-stat">
          <div class="sb-stat-val">${avgRating}</div>
          <div class="sb-stat-label">Рейтинг</div>
        </div>
      </div>
    </div>`;

  // История интервью
  const ivItems = interviews.map(iv => {
    const canComplete = iv.status === 'upcoming' && isInterviewer;
    const reviewed    = getReviews().find(r => r.appId === iv.id && r.authorEmail === user.email);
    const canReview   = iv.status === 'done' && !reviewed;
    return `
    <div class="sb-interview-item">
      <div class="sb-iv-icon ${iv.status}">●</div>
      <div class="sb-iv-info">
        <div class="sb-iv-name">${isInterviewer ? 'Кандидат: ' + iv.name : 'Интервьюер: ' + iv.name}</div>
        <div class="sb-iv-date">${iv.date}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0;">
        <div class="sb-iv-status ${iv.status}">${iv.status === 'done' ? 'Завершено' : 'Предстоит'}</div>
        ${canComplete ? `<button class="sb-complete-btn" onclick="markCompleted('${iv.id}')">✓ Завершить</button>` : ''}
        ${canReview   ? `<button class="sb-review-btn"   onclick="openReviewModal('${iv.id}','${iv.name}')">★ Отзыв</button>` : ''}
        ${reviewed    ? `<span style="font-size:11px;color:#34d399;">Отзыв оставлен</span>` : ''}
      </div>
    </div>`;
  }).join('');

  const historyBlock = `
    <div>
      <div class="sb-card-title">${isInterviewer ? 'Проведённые интервью' : 'Мои интервью'}</div>
      <div class="sb-interview-list">
        ${ivItems || '<div class="sb-empty"><div class="sb-empty-icon" style="font-size:28px;margin-bottom:6px;">📭</div>Пока нет принятых заявок</div>'}
      </div>
    </div>`;

  // Отзывы
  const reviewItems = reviews.map(r => `
    <div class="sb-review">
      <div class="sb-review-header">
        <span class="sb-review-author">${r.authorName}</span>
        <span class="sb-stars">${starsHtml(r.stars)}</span>
      </div>
      <div class="sb-review-text">${r.text}</div>
    </div>`).join('');

  const reviewsBlock = `
    <div>
      <div class="sb-card-title">Отзывы (${reviews.length})</div>
      <div class="sb-reviews">
        ${reviewItems || '<div class="sb-empty"><div class="sb-empty-icon" style="font-size:28px;margin-bottom:6px;">💬</div>Отзывов пока нет</div>'}
      </div>
    </div>`;

  // Редактирование профиля
  const editBlock = isInterviewer ? `
    <div>
      <div class="sb-card-title">Редактировать профиль</div>
      <div class="sb-edit-form">
        <div class="form-group">
          <label>Имя</label>
          <input type="text" id="editName" value="${userData.name}" />
        </div>
        <div class="form-group">
          <label>Специализация</label>
          <div class="tags-input-wrap" id="editSpecWrap">
            <input class="tags-input-field" id="editSpecInput" placeholder="Введи и нажми Enter..." />
          </div>
          <div class="tags-hint">Enter или запятая — добавить, Backspace — удалить</div>
          <input type="hidden" id="editSpec" value="${userData.spec || ''}" />
        </div>
        <div class="form-group">
          <label>Опыт (лет)</label>
          <input type="number" id="editExp" value="${userData.exp || ''}" min="0" max="40" />
        </div>
        <div class="form-group">
          <label>О себе</label>
          <textarea id="editBio">${userData.bio || ''}</textarea>
        </div>
        <button class="sb-save-btn" onclick="saveProfileEdit()">Сохранить изменения</button>
      </div>
    </div>` : `
    <div>
      <div class="sb-card-title">Редактировать профиль</div>
      <div class="sb-edit-form">
        <div class="form-group">
          <label>Имя</label>
          <input type="text" id="editName" value="${userData.name}" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="editEmail" value="${userData.email}" />
        </div>
        <button class="sb-save-btn" onclick="saveProfileEdit()">Сохранить изменения</button>
      </div>
    </div>`;

  // Директ-чаты (входящие сообщения)
  const dchats = getMyDirectChats();
  let dchatBlock = '';
  if (dchats.length > 0) {
    const items = dchats.map(dc => `
      <div class="sb-interview-item" style="cursor:pointer;" onclick="openDirectChat('${dc.otherEmail}','${dc.otherName}');closeProfileSidebar();">
        <div class="sb-iv-icon done">💬</div>
        <div class="sb-iv-info">
          <div class="sb-iv-name">${dc.otherName}</div>
          <div class="sb-iv-date">${dc.last.type === 'text' ? dc.last.text.slice(0, 42) + (dc.last.text.length > 42 ? '…' : '') : 'Системное сообщение'}</div>
        </div>
        <div class="sb-iv-status done">Открыть</div>
      </div>`).join('');
    dchatBlock = `
      <div>
        <div class="sb-card-title">Сообщения</div>
        <div class="sb-interview-list">${items}</div>
      </div>`;
  }

  body.innerHTML = identityBlock + statsBlock + (dchatBlock || '') + historyBlock + reviewsBlock + editBlock;

  // Инициализируем тег-инпут для специализации (если интервьюер)
  if (isInterviewer) {
    const existingTags = (userData.spec || '').split(',').map(s => s.trim()).filter(Boolean);
    setTimeout(() => {
      tagInputs.edit = initTagInput('editSpecWrap', 'editSpecInput', 'editSpec', existingTags);
    }, 30);
  }
}

function saveProfileEdit() {
  const users = getUsers();
  const idx   = users.findIndex(u => u.email === state.currentUser.email);
  if (idx === -1) return;

  const nameEl  = document.getElementById('editName');
  const specEl  = document.getElementById('editSpec');
  const expEl   = document.getElementById('editExp');
  const bioEl   = document.getElementById('editBio');
  const emailEl = document.getElementById('editEmail');

  if (nameEl)  users[idx].name  = nameEl.value.trim()  || users[idx].name;
  if (specEl)  users[idx].spec  = specEl.value.trim();
  if (expEl)   users[idx].exp   = expEl.value;
  if (bioEl)   users[idx].bio   = bioEl.value.trim();
  if (emailEl) users[idx].email = emailEl.value.trim() || users[idx].email;

  localStorage.setItem('ih_users', JSON.stringify(users));
  state.currentUser = { ...state.currentUser, ...users[idx] };
  localStorage.setItem('ih_current', JSON.stringify(state.currentUser));

  showToast('Профиль обновлён ✓', 'success');
  updateNavForUser(state.currentUser);
  renderInterviewers();
  renderSidebar(state.currentUser);
}

// Закрытие сайдбара
document.getElementById('sidebarClose').addEventListener('click', closeProfileSidebar);
document.getElementById('profileBackdrop').addEventListener('click', closeProfileSidebar);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfileSidebar(); });


// =============================================
//   ЗАЯВКИ — APPLICATIONS
// =============================================

let currentAppTab = 'pending';

function showApplicationsSection() {
  const sec = document.getElementById('applicationsSection');
  const meetSec = document.getElementById('myMeetingsSection');
  if (!state.currentUser) return;
  if (state.currentUser.role === 'interviewer') {
    sec.style.display = 'block';
    meetSec.style.display = 'none';
    renderApplications();
  } else {
    sec.style.display = 'none';
    meetSec.style.display = 'block';
    renderMyMeetings();
  }
}

// Форматирование даты
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// ---- ИНТЕРВЬЮЕР: рендер входящих заявок ----
function renderApplications() {
  const listEl  = document.getElementById('appsList');
  const badgeEl = document.getElementById('appsBadge');
  const apps    = getApplications().filter(a => a.interviewerName === state.currentUser.name);
  const filtered = apps.filter(a => a.status === currentAppTab);
  const pendingCount = apps.filter(a => a.status === 'pending').length;

  badgeEl.textContent = pendingCount
    ? `${pendingCount} новых заявок`
    : 'Новых заявок нет';

  // Уведомление в навбаре
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    const dot = profileBtn.querySelector('.nav-notif-dot');
    if (pendingCount > 0 && !dot) {
      profileBtn.style.position = 'relative';
      const d = document.createElement('span');
      d.className = 'nav-notif-dot';
      d.style.cssText = 'position:absolute;top:2px;right:2px;width:8px;height:8px;background:#f87171;border-radius:50%;border:2px solid var(--bg);';
      profileBtn.appendChild(d);
    } else if (pendingCount === 0 && dot) {
      dot.remove();
    }
  }

  if (filtered.length === 0) {
    const labels = { pending: 'Новых заявок нет', accepted: 'Нет принятых заявок', rejected: 'Нет отклонённых заявок' };
    const icons  = { pending: '📭', accepted: '✅', rejected: '🚫' };
    listEl.innerHTML = `<div class="apps-empty"><div class="apps-empty-icon">${icons[currentAppTab]}</div><h3>${labels[currentAppTab]}</h3></div>`;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach((app, i) => {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.style.animationDelay = `${i * 0.05}s`;

    const statusLabels = { pending: 'На рассмотрении', accepted: 'Принято', rejected: 'Отклонено', completed: 'Завершено' };

    let actions = '';
    if (app.status === 'pending') {
      actions = `
        <button class="btn-accept" onclick="acceptApp('${app.id}')">✓ Принять</button>
        <button class="btn-reject" onclick="rejectApp('${app.id}')">✕ Отклонить</button>`;
    } else if (app.status === 'accepted') {
      actions = `
        <button class="btn-chat" onclick="openChat('${app.id}')"><span class="btn-chat-dot"></span>Чат</button>
        <button class="btn-accept" onclick="markCompleted('${app.id}')">✓ Завершить</button>`;
    } else if (app.status === 'completed') {
      const reviewed = getReviews().find(r => r.appId === app.id && r.authorEmail === state.currentUser.email);
      actions = `<button class="btn-chat" onclick="openChat('${app.id}')"><span class="btn-chat-dot"></span>Чат</button>`;
      if (!reviewed) actions += `<button class="sb-review-btn" onclick="openReviewModal('${app.id}','${app.candidateName}')">★ Отзыв</button>`;
    }

    card.innerHTML = `
      <div class="app-avatar">🎯</div>
      <div class="app-info">
        <div class="app-name">${app.candidateName}</div>
        <div class="app-meta">Заявка подана ${fmtDate(app.createdAt)}</div>
      </div>
      <div class="app-status ${app.status}">${statusLabels[app.status]}</div>
      <div class="app-actions">${actions}</div>
    `;
    listEl.appendChild(card);
  });
}

function acceptApp(id) {
  updateAppStatus(id, 'accepted');
  const app = getAppById(id);
  // Добавляем системное сообщение в чат
  addMessage(id, {
    type: 'system',
    text: 'Заявка принята! Обсудите удобное время для интервью.',
    ts: new Date().toISOString(),
  });
  renderApplications();
  showToast('Заявка принята! Теперь вы можете общаться в чате.', 'success');
}

function rejectApp(id) {
  updateAppStatus(id, 'rejected');
  renderApplications();
  showToast('Заявка отклонена.', 'default');
}

function cancelApplication(id) {
  if (!confirm('Отменить заявку? Это действие нельзя отменить.')) return;
  const apps = getApplications().filter(a => a.id !== id);
  localStorage.setItem('ih_apps', JSON.stringify(apps));
  renderMyMeetings();
  showToast('Заявка отменена', 'default');
}

// Переключение вкладок
document.querySelectorAll('.apps-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.apps-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentAppTab = tab.dataset.tab;
    renderApplications();
  });
});

// ---- КАНДИДАТ: мои встречи ----
function renderMyMeetings() {
  const listEl = document.getElementById('myMeetingsList');
  const apps = getApplications().filter(a => a.candidateEmail === state.currentUser.email);

  if (apps.length === 0) {
    listEl.innerHTML = `<div class="apps-empty"><div class="apps-empty-icon">📅</div><h3>Заявок пока нет</h3><p style="color:var(--text-muted);font-size:14px;margin-top:6px;">Запишись к интервьюеру выше</p></div>`;
    return;
  }

  listEl.innerHTML = '';
  const statusLabels = { pending: 'На рассмотрении', accepted: 'Принято', rejected: 'Отклонено', completed: 'Завершено' };

  apps.slice().reverse().forEach((app, i) => {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.style.animationDelay = `${i * 0.05}s`;

    let actions = '';
    if (app.status === 'accepted') {
      actions = `<button class="btn-chat" onclick="openChat('${app.id}')"><span class="btn-chat-dot"></span>Чат</button>`;
    }
    if (app.status === 'completed') {
      const reviewed = getReviews().find(r => r.appId === app.id && r.authorEmail === state.currentUser.email);
      actions = `<button class="btn-chat" onclick="openChat('${app.id}')"><span class="btn-chat-dot"></span>Чат</button>`;
      if (!reviewed) actions += `<button class="sb-review-btn" onclick="openReviewModal('${app.id}','${app.interviewerName}')">★ Отзыв</button>`;
    }
    if (app.status === 'pending' || app.status === 'accepted') {
      actions += `<button class="btn-cancel-app" onclick="cancelApplication('${app.id}')">Отменить</button>`;
    }

    card.innerHTML = `
      <div class="app-avatar">🧑‍💼</div>
      <div class="app-info">
        <div class="app-name">${app.interviewerName}</div>
        <div class="app-meta">Подано ${fmtDate(app.createdAt)}</div>
      </div>
      <div class="app-status ${app.status}">${statusLabels[app.status]}</div>
      <div class="app-actions">${actions}</div>
    `;
    listEl.appendChild(card);
  });
}

// =============================================
//   ЧАТ
// =============================================

let activeChatAppId = null;
let chatPollInterval = null;

function openChat(appId) {
  const app = getAppById(appId);
  if (!app) return;
  activeChatAppId = appId;

  const isInterviewer = state.currentUser.role === 'interviewer';
  const otherName = isInterviewer ? app.candidateName : app.interviewerName;

  document.getElementById('chatName').textContent = otherName;
  document.getElementById('chatAvatar').textContent = isInterviewer ? '🎯' : '🧑‍💼';
  document.getElementById('chatSub').textContent = '● онлайн';

  renderChatMessages(appId);

  document.getElementById('chatWindow').classList.add('open');
  document.getElementById('chatBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('chatInput').focus();

  // Лёгкий polling чтобы видеть новые сообщения (имитация real-time)
  clearInterval(chatPollInterval);
  chatPollInterval = setInterval(() => {
    if (activeChatAppId) renderChatMessages(activeChatAppId, false);
  }, 1500);
}

function closeChat() {
  document.getElementById('chatWindow').classList.remove('open');
  document.getElementById('chatBackdrop').classList.remove('open');
  document.body.style.overflow = '';
  clearInterval(chatPollInterval);
  activeChatAppId = null;
}

function renderChatMessages(appId, scrollToBottom = true) {
  const msgs   = getMessages(appId);
  const el     = document.getElementById('chatMessages');
  // Не перерисовываем если кол-во сообщений не изменилось (избегаем мигания)
  const currentCount = el.querySelectorAll('.chat-msg, .chat-system').length;
  const newCount = msgs.filter(m => m.type === 'text' || m.type === 'system').length;
  if (!scrollToBottom && currentCount === newCount) return;
  const prevH  = el.scrollHeight;

  el.innerHTML = '';

  if (msgs.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:40px;">Начните общение — обсудите удобное время 📅</div>`;
    return;
  }

  let lastDate = '';
  msgs.forEach(msg => {
    if (msg.type === 'system') {
      const div = document.createElement('div');
      div.className = 'chat-system';
      div.textContent = msg.text;
      el.appendChild(div);
      return;
    }

    const msgDate = new Date(msg.ts).toLocaleDateString('ru-RU');
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const divider = document.createElement('div');
      divider.className = 'chat-day-divider';
      divider.textContent = msgDate;
      el.appendChild(divider);
    }

    const isMine = msg.senderEmail === state.currentUser.email;
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${isMine ? 'mine' : 'theirs'}`;

    const time = new Date(msg.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    wrap.innerHTML = `
      <div class="chat-bubble">${escapeHtml(msg.text)}</div>
      <div class="chat-time">${isMine ? '' : msg.senderName + ' · '}${time}</div>
    `;
    el.appendChild(wrap);
  });

  if (scrollToBottom) el.scrollTop = el.scrollHeight;
  else if (el.scrollHeight > prevH) el.scrollTop = el.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// sendChatMessage перенесён в модуль директ-чата ниже

document.getElementById('chatSend').addEventListener('click', sendChatMessage);
document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});
document.getElementById('chatClose').addEventListener('click', closeChat);
document.getElementById('chatBackdrop').addEventListener('click', closeChat);


// =============================================
//   ПЕРЕКЛЮЧЕНИЕ РОЛИ
// =============================================

function switchRole() {
  if (!state.currentUser) return;
  const newRole = state.currentUser.role === 'candidate' ? 'interviewer' : 'candidate';
  const roles   = state.currentUser.roles || [state.currentUser.role];

  // Если роль интервьюера уже есть — просто переключаем активную без формы
  if (newRole === 'interviewer' && roles.includes('interviewer')) {
    applyRoleSwitch('interviewer', {});
  } else if (newRole === 'interviewer') {
    openSwitchRoleModal();
  } else {
    applyRoleSwitch('candidate', {});
  }
}

function openSwitchRoleModal() {
  // Используем существующий modal-overlay, добавляем новый экран
  const overlay = document.getElementById('modalOverlay');
  // Скрываем все экраны и показываем switch-экран
  document.querySelectorAll('.modal-screen').forEach(s => s.classList.add('hidden'));

  let sw = document.getElementById('screenSwitch');
  if (!sw) {
    sw = document.createElement('div');
    sw.className = 'modal-screen';
    sw.id = 'screenSwitch';
    sw.innerHTML = `
      <div class="switch-role-header">
        <div class="switch-role-icon">🔄</div>
        <h2>Стать интервьюером</h2>
        <p>Заполни профиль — кандидаты смогут найти тебя</p>
      </div>
      <div class="form-group">
        <label>Специализация</label>
        <div class="tags-input-wrap" id="swSpecWrap">
          <input class="tags-input-field" id="swSpecInput" placeholder="Введи и нажми Enter..." />
        </div>
        <div class="tags-hint">Enter или запятая — добавить</div>
        <input type="hidden" id="swSpec" />
      </div>
      <div class="form-group">
        <label>Опыт (лет)</label>
        <input type="number" id="swExp" placeholder="3" min="0" max="40" />
      </div>
      <div class="form-group">
        <label>О себе</label>
        <textarea id="swBio" placeholder="Чем можешь помочь кандидатам..."></textarea>
      </div>
      <button class="btn-primary btn-full" id="swConfirm">Стать интервьюером</button>
      <button class="btn-ghost" id="swCancel" style="width:100%;margin-top:8px;">Отмена</button>
    `;
    document.getElementById('modal').appendChild(sw);
    setTimeout(() => {
      tagInputs.sw = initTagInput('swSpecWrap','swSpecInput','swSpec',[]);
    }, 30);
    document.getElementById('swConfirm').addEventListener('click', () => {
      const spec = document.getElementById('swSpec').value.trim();  // hidden заполняется тег-инпутом
      const exp  = document.getElementById('swExp').value;
      const bio  = document.getElementById('swBio').value.trim();
      if (!spec) { showToast('Укажи специализацию', 'error'); return; }
      applyRoleSwitch('interviewer', { spec, exp, bio });
      closeModal();
    });
    document.getElementById('swCancel').addEventListener('click', closeModal);
  } else {
    // сбросить поля
    ['swSpec','swSpecInput','swExp','swBio'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('swSpecWrap')) {
      document.getElementById('swSpecWrap').querySelectorAll('.spec-tag-chip').forEach(c => c.remove());
    }
    setTimeout(() => {
      tagInputs.sw = initTagInput('swSpecWrap','swSpecInput','swSpec',[]);
    }, 30);
    sw.classList.remove('hidden');
  }

  sw.classList.remove('hidden');
  overlay.classList.add('open');
}

function applyRoleSwitch(newRole, extra) {
  const users = getUsers();
  const idx   = users.findIndex(u => u.email === state.currentUser.email);
  if (idx < 0) return;

  // Инициализируем массив ролей из старого формата если нужно
  if (!Array.isArray(users[idx].roles)) {
    users[idx].roles = [users[idx].role || 'candidate'];
  }

  // Добавляем новую роль (не удаляем старую — пользователь может быть обеими)
  if (!users[idx].roles.includes(newRole)) {
    users[idx].roles.push(newRole);
  }

  // Активная роль (для UI) — та, на которую переключились
  users[idx].role = newRole;

  // Если добавляем роль интервьюера — сохраняем его данные
  if (newRole === 'interviewer') {
    if (extra.spec !== undefined) users[idx].spec = extra.spec;
    if (extra.exp  !== undefined) users[idx].exp  = extra.exp;
    if (extra.bio  !== undefined) users[idx].bio  = extra.bio;
  }

  localStorage.setItem('ih_users', JSON.stringify(users));
  state.currentUser = { ...state.currentUser, ...users[idx] };
  localStorage.setItem('ih_current', JSON.stringify(state.currentUser));

  const label = newRole === 'interviewer' ? 'интервьюера' : 'кандидата';
  const hasBoth = users[idx].roles.length > 1;
  showToast(
    hasBoth
      ? `Переключились на роль ${label}. Профиль интервьюера сохранён 👍`
      : `Роль изменена! Теперь ты ${label} 🎉`,
    'success'
  );

  updateNavForUser(state.currentUser);
  renderInterviewers();
  showApplicationsSection();
  closeProfileSidebar();
}

// =============================================
//   ДИРЕКТ-ЧАТ (до подачи заявки)
// =============================================
// Ключ директ-чата: ih_dchat_<canonicalName1>__<canonicalName2>
function getDChatKey(nameA, nameB) {
  const sorted = [nameA, nameB].sort();
  return 'ih_dchat_' + sorted[0].replace(/\s+/g,'_') + '__' + sorted[1].replace(/\s+/g,'_');
}

function getDChatMessages(nameA, nameB) {
  return JSON.parse(localStorage.getItem(getDChatKey(nameA, nameB)) || '[]');
}

function addDChatMessage(nameA, nameB, msg) {
  const key  = getDChatKey(nameA, nameB);
  const msgs = JSON.parse(localStorage.getItem(key) || '[]');
  msgs.push(msg);
  localStorage.setItem(key, JSON.stringify(msgs));
}

// activeChatContext: { type: 'app'|'direct', appId?, myName?, otherName? }
let activeChatContext = null;

function openDirectChat(interviewerName) {
  if (!state.currentUser) {
    showToast('Войди, чтобы написать интервьюеру', 'error');
    openModal('login');
    return;
  }
  if (state.currentUser.name === interviewerName) {
    showToast('Нельзя написать самому себе', 'error');
    return;
  }

  activeChatContext = {
    type:      'direct',
    myName:    state.currentUser.name,
    otherName: interviewerName,
  };
  activeChatAppId = null; // сбрасываем старый контекст

  const isInterviewer = state.currentUser.role === 'interviewer';
  document.getElementById('chatName').textContent = interviewerName;
  document.getElementById('chatAvatar').textContent = '🧑‍💼';
  document.getElementById('chatSub').textContent = '● директ-чат';

  renderDirectMessages();

  document.getElementById('chatWindow').classList.add('open');
  document.getElementById('chatBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('chatInput').focus();

  clearInterval(chatPollInterval);
  chatPollInterval = setInterval(() => {
    if (activeChatContext?.type === 'direct') renderDirectMessages(false);
  }, 1500);
}

function renderDirectMessages(scrollToBottom = true) {
  if (!activeChatContext || activeChatContext.type !== 'direct') return;
  const { myName, otherName } = activeChatContext;
  const msgs = getDChatMessages(myName, otherName);
  const el   = document.getElementById('chatMessages');
  // Не перерисовываем если кол-во сообщений не изменилось (избегаем мигания)
  const currentCount = el.querySelectorAll('.chat-msg, .chat-system').length;
  const newCount = msgs.filter(m => m.type === 'text' || m.type === 'system').length;
  if (!scrollToBottom && currentCount === newCount) return;
  const prevH = el.scrollHeight;
  el.innerHTML = '';

  if (msgs.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:40px;padding:0 20px;">Можешь задать любой вопрос до подачи заявки 💬</div>`;
    return;
  }

  let lastDate = '';
  msgs.forEach(msg => {
    if (msg.type === 'system') {
      const div = document.createElement('div');
      div.className = 'chat-system';
      div.textContent = msg.text;
      el.appendChild(div);
      return;
    }
    const msgDate = new Date(msg.ts).toLocaleDateString('ru-RU');
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const divider = document.createElement('div');
      divider.className = 'chat-day-divider';
      divider.textContent = msgDate;
      el.appendChild(divider);
    }
    const isMine = msg.senderName === state.currentUser.name;
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${isMine ? 'mine' : 'theirs'}`;
    const time = new Date(msg.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    wrap.innerHTML = `
      <div class="chat-bubble">${escapeHtml(msg.text)}</div>
      <div class="chat-time">${isMine ? '' : msg.senderName + ' · '}${time}</div>
    `;
    el.appendChild(wrap);
  });

  if (scrollToBottom) el.scrollTop = el.scrollHeight;
  else if (el.scrollHeight > prevH) el.scrollTop = el.scrollHeight;
}

// Патчим sendChatMessage чтобы он понимал оба контекста
function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  if (activeChatContext?.type === 'direct') {
    const { myName, otherName } = activeChatContext;
    addDChatMessage(myName, otherName, {
      type:       'text',
      senderName: state.currentUser.name,
      text,
      ts: new Date().toISOString(),
    });
    input.value = '';
    renderDirectMessages();
    return;
  }

  if (!activeChatAppId) return;
  addMessage(activeChatAppId, {
    type:        'text',
    senderEmail: state.currentUser.email,
    senderName:  state.currentUser.name,
    text,
    ts: new Date().toISOString(),
  });
  input.value = '';
  renderChatMessages(activeChatAppId);
}

// Интервьюер видит входящие директ-чаты в сайдбаре — добавим в renderSidebar
// (вызывается через патч ниже)
function getMyDirectChats() {
  if (!state.currentUser) return [];
  const myName = state.currentUser.name;
  // Кодируем имя так же как в getDChatKey чтобы точно совпадало
  const myEncoded = myName.replace(/\s+/g, '_');
  const result = [];
  const seen = new Set();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('ih_dchat_')) continue;

    // Ключ: ih_dchat_ИмяA__ИмяB — разбиваем по разделителю __
    const raw = key.slice('ih_dchat_'.length);
    const parts = raw.split('__');
    if (parts.length !== 2) continue;

    const [encA, encB] = parts;
    if (encA !== myEncoded && encB !== myEncoded) continue;

    // Декодируем имя собеседника
    const otherEncoded = encA === myEncoded ? encB : encA;
    const otherName = otherEncoded.replace(/_/g, ' ');

    if (seen.has(otherName)) continue;
    seen.add(otherName);

    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    if (msgs.length === 0) continue;
    const last = msgs[msgs.length - 1];
    result.push({ otherName, last, key });
  }
  // Сортируем по времени последнего сообщения (новые сначала)
  result.sort((a, b) => new Date(b.last.ts) - new Date(a.last.ts));
  return result;
}


// =============================================
//   ОТЗЫВЫ — хранилище
// =============================================
function getReviews() {
  return JSON.parse(localStorage.getItem('ih_reviews') || '[]');
}

// Рейтинг пользователя по его email
function getUserRating(email) {
  const reviews = getReviews().filter(r => r.aboutEmail === email);
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  return { avg: avg.toFixed(1), count: reviews.length };
}
function saveReview(review) {
  const reviews = getReviews();
  reviews.push(review);
  localStorage.setItem('ih_reviews', JSON.stringify(reviews));
}

// =============================================
//   ЗАВЕРШЕНИЕ ИНТЕРВЬЮ
// =============================================
function markCompleted(appId) {
  if (!confirm('Отметить интервью как завершённое?')) return;
  updateAppStatus(appId, 'completed');

  // Обновляем также в renderApplications и renderMyMeetings
  renderApplications();
  renderMyMeetings();

  // Добавляем системное сообщение в чат
  const existing = getMessages(appId);
  addMessage(appId, {
    type: 'system',
    text: 'Интервью завершено! Пожалуйста, оставьте отзыв друг о друге.',
    ts:   new Date().toISOString(),
  });

  showToast('Интервью отмечено как завершённое ✓', 'success');
  // Перерисовываем сайдбар
  renderSidebar(state.currentUser);
}

// =============================================
//   МОДАЛКА ОТЗЫВА
// =============================================
let reviewContext = null; // { appId, aboutName, aboutEmail }
let selectedStars = 0;

function openReviewModal(appId, aboutName) {
  const app = getAppById(appId);
  if (!app) return;

  // Определяем email того, о ком пишем отзыв
  const isInterviewer = state.currentUser.role === 'interviewer';
  const aboutEmail    = isInterviewer
    ? app.candidateEmail
    : getUsers().find(u => u.name === app.interviewerName)?.email || app.interviewerName;

  reviewContext = { appId, aboutName, aboutEmail };
  selectedStars = 0;

  document.getElementById('reviewAboutName').textContent = 'об: ' + aboutName;
  document.getElementById('reviewText').value = '';

  // Сбрасываем звёзды
  document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('reviewOverlay').classList.add('open');
  closeProfileSidebar();
}

function closeReviewModal() {
  document.getElementById('reviewOverlay').classList.remove('open');
  reviewContext = null;
  selectedStars = 0;
}

// Звёзды
document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedStars = parseInt(btn.dataset.val);
    document.querySelectorAll('.star-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.val) <= selectedStars);
    });
  });
  btn.addEventListener('mouseenter', () => {
    const val = parseInt(btn.dataset.val);
    document.querySelectorAll('.star-btn').forEach(b => {
      b.style.color = parseInt(b.dataset.val) <= val ? '#fbbf24' : '';
    });
  });
  btn.addEventListener('mouseleave', () => {
    document.querySelectorAll('.star-btn').forEach(b => {
      b.style.color = '';
      b.classList.toggle('active', parseInt(b.dataset.val) <= selectedStars);
    });
  });
});

document.getElementById('submitReview').addEventListener('click', () => {
  if (!reviewContext) return;
  if (!selectedStars) { showToast('Выбери оценку', 'error'); return; }
  const text = document.getElementById('reviewText').value.trim();
  if (!text) { showToast('Напиши комментарий', 'error'); return; }

  saveReview({
    id:          'rev_' + Date.now(),
    appId:       reviewContext.appId,
    authorEmail: state.currentUser.email,
    authorName:  state.currentUser.name,
    aboutEmail:  reviewContext.aboutEmail,
    stars:       selectedStars,
    text,
    createdAt:   new Date().toISOString(),
  });

  closeReviewModal();
  showToast('Отзыв отправлен! Спасибо 🙏', 'success');
});

document.getElementById('reviewModalClose').addEventListener('click', closeReviewModal);
document.getElementById('reviewOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('reviewOverlay')) closeReviewModal();
});
document.getElementById('pubProfileOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('pubProfileOverlay')) closePublicProfile();
});


// =============================================
//   ПУБЛИЧНЫЙ ПРОФИЛЬ
// =============================================
function openPublicProfile(email, name) {
  if (!email) { showToast('Профиль недоступен', 'error'); return; }

  const user    = getUsers().find(u => u.email === email);
  const mock    = MOCK_INTERVIEWERS.find(m => m.email === email);
  const data    = user || mock || {};
  const reviews = getReviews().filter(r => r.aboutEmail === email);
  const rating  = getUserRating(email);

  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const spec     = data.spec || '';
  const bio      = data.bio  || '';
  const exp      = data.exp  || '';

  const ratingHtml = rating
    ? `<div class="pub-rating">★ ${rating.avg} · ${rating.count} отзыв${rating.count === 1 ? '' : rating.count < 5 ? 'а' : 'ов'}</div>`
    : `<div class="pub-rating" style="color:var(--text-muted);">Нет отзывов</div>`;

  const specTags = spec
    ? spec.split(',').map(s => s.trim()).filter(Boolean)
        .map(s => `<span class="tag">${s}</span>`).join('')
    : '';

  const reviewsHtml = reviews.length
    ? reviews.map(r => `
        <div class="sb-review">
          <div class="sb-review-header">
            <span class="sb-review-author">${r.authorName}</span>
            <span class="sb-stars">${starsHtml(r.stars)}</span>
          </div>
          <div class="sb-review-text">${r.text}</div>
        </div>`).join('')
    : `<div class="sb-empty" style="padding:20px 0;"><div style="font-size:28px;margin-bottom:6px;">💬</div>Отзывов пока нет</div>`;

  document.getElementById('pubProfileBody').innerHTML = `
    <div class="pub-header">
      <div class="pub-avatar">${initials}</div>
      <div class="pub-info">
        <div class="pub-name">${name}</div>
        ${ratingHtml}
        ${exp ? `<div class="pub-exp">Опыт: ${exp} ${expLabel(Number(exp))}</div>` : ''}
      </div>
    </div>
    ${specTags ? `<div class="card-tags" style="margin-top:16px;">${specTags}</div>` : ''}
    ${bio ? `<p class="pub-bio">${bio}</p>` : ''}
    <div class="pub-section-title">Отзывы (${reviews.length})</div>
    <div class="sb-reviews">${reviewsHtml}</div>
  `;

  document.getElementById('pubProfileOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePublicProfile() {
  document.getElementById('pubProfileOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
// ---------- ИНИЦИАЛИЗАЦИЯ ----------
loadCurrentUser();
renderInterviewers();
showApplicationsSection();
