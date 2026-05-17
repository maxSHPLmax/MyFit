// ============================================
// MyFit — основная логика приложения
// ============================================

// --- Настройки ---
const DAILY_GOAL = 2000;          // дневная цель в ккал
const STORAGE_KEY = 'myfit-data'; // текущий день
const HISTORY_KEY = 'myfit-history'; // архив закрытых дней

// --- Состояние приложения ---
let foods = [];           // продукты текущего дня
let activities = [];      // активности текущего дня
let history = [];         // массив закрытых дней
let selectedProduct = null;
let chartPeriod = 7;      // 7 или 30 — сколько дней показывать

// --- Ссылки на элементы ---
const $ = (id) => document.getElementById(id);

const dateEl       = $('today-date');
const balanceNumEl = $('balance-num');
const eatenNumEl   = $('eaten-num');
const burnedNumEl  = $('burned-num');
const progressBar  = $('progress-bar');
const goalStatus   = $('goal-status');

const foodSearch   = $('food-search');
const foodSuggest  = $('food-suggest');
const foodGrams    = $('food-grams');
const foodCalc     = $('food-calc');
const foodListEl   = $('food-list');
const addFoodBtn   = $('add-food-btn');

const actType      = $('act-type');
const actMin       = $('act-min');
const actListEl    = $('act-list');
const addActBtn    = $('add-act-btn');

const closeDayBtn  = $('close-day-btn');
const resetBtn     = $('reset-btn');

const historyChart = $('history-chart');
const historyEmpty = $('history-empty');

// ============================================
// 1. ДАТА
// ============================================
function showTodayDate() {
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

// ============================================
// 2. ПОИСК ПРОДУКТОВ
// ============================================
function showSuggestions(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    foodSuggest.style.display = 'none';
    return;
  }

  const matches = PRODUCTS
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 6);

  if (matches.length === 0) {
    foodSuggest.innerHTML = '<div class="suggest-empty">Ничего не найдено</div>';
    foodSuggest.style.display = 'block';
    return;
  }

  foodSuggest.innerHTML = matches.map(p => `
    <div class="suggest-item" data-name="${escapeHtml(p.name)}">
      <span>${escapeHtml(p.name)}</span>
      <span class="suggest-meta">${p.kcal100} ккал/100г</span>
    </div>
  `).join('');

  foodSuggest.style.display = 'block';

  foodSuggest.querySelectorAll('.suggest-item').forEach(item => {
    item.onclick = () => {
      const name = item.dataset.name;
      selectedProduct = PRODUCTS.find(p => p.name === name);
      foodSearch.value = name;
      foodSuggest.style.display = 'none';
      updateCalcPreview();
      foodGrams.focus();
    };
  });
}

// ============================================
// 3. ПРЕДВАРИТЕЛЬНЫЙ ПОДСЧЁТ КАЛОРИЙ
// ============================================
function updateCalcPreview() {
  const grams = parseFloat(foodGrams.value);
  if (selectedProduct && grams > 0) {
    const kcal = (selectedProduct.kcal100 * grams) / 100;
    foodCalc.textContent = `= ${Math.round(kcal)} ккал`;
    foodCalc.classList.add('active');
  } else {
    foodCalc.textContent = '= 0 ккал';
    foodCalc.classList.remove('active');
  }
}

// ============================================
// 4. ДОБАВЛЕНИЕ ПРОДУКТА
// ============================================
function addFood() {
  const grams = parseFloat(foodGrams.value);

  if (!selectedProduct) {
    alert('Выбери продукт из списка');
    return;
  }
  if (!grams || grams <= 0) {
    alert('Укажи вес в граммах');
    return;
  }

  const kcal = (selectedProduct.kcal100 * grams) / 100;

  foods.push({
    name: selectedProduct.name,
    grams: grams,
    kcal: kcal
  });

  foodSearch.value = '';
  foodGrams.value = '';
  selectedProduct = null;
  updateCalcPreview();

  render();
}

// ============================================
// 5. ДОБАВЛЕНИЕ АКТИВНОСТИ
// ============================================
function addActivity() {
  const rate = parseFloat(actType.value);
  const name = actType.options[actType.selectedIndex].text.split(' (')[0];
  const min  = parseFloat(actMin.value);

  if (!min || min <= 0) {
    alert('Укажи количество минут');
    return;
  }

  activities.push({
    name: name,
    min: min,
    kcal: rate * min
  });

  actMin.value = '';
  render();
}

// ============================================
// 6. ОТРИСОВКА
// ============================================
function render() {
  save();

  const eaten   = foods.reduce((sum, f) => sum + f.kcal, 0);
  const burned  = activities.reduce((sum, a) => sum + a.kcal, 0);
  const balance = eaten - burned;

  eatenNumEl.textContent   = Math.round(eaten);
  burnedNumEl.textContent  = Math.round(burned);
  balanceNumEl.textContent = Math.round(balance);

  const percent = Math.min(100, Math.max(0, (balance / DAILY_GOAL) * 100));
  progressBar.style.width = percent + '%';

  if (balance > DAILY_GOAL) {
    progressBar.style.background = '#e24b4a';
  } else if (balance > DAILY_GOAL * 0.8) {
    progressBar.style.background = '#ef9f27';
  } else {
    progressBar.style.background = '#1d9e75';
  }

  const remaining = DAILY_GOAL - balance;
  if (foods.length === 0 && activities.length === 0) {
    goalStatus.textContent = 'Добавь продукт ниже ↓';
  } else if (remaining > 0) {
    goalStatus.textContent = `Осталось ${Math.round(remaining)} ккал до цели`;
  } else {
    goalStatus.textContent = `Цель достигнута! Превышение: ${Math.round(-remaining)} ккал`;
  }

  renderFoodList();
  renderActivityList();
  updateCloseDayBtn();
  renderHistory();
}

function renderFoodList() {
  foodListEl.innerHTML = foods.map((f, i) => `
    <div class="list-item">
      <span class="list-item-name">
        ${escapeHtml(f.name)} · <span class="list-item-meta">${f.grams} г</span>
      </span>
      <span>
        <span class="list-item-kcal">${Math.round(f.kcal)} ккал</span>
        <button class="btn-remove" data-i="${i}">✕</button>
      </span>
    </div>
  `).join('');

  foodListEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.onclick = () => {
      foods.splice(parseInt(btn.dataset.i), 1);
      render();
    };
  });
}

function renderActivityList() {
  actListEl.innerHTML = activities.map((a, i) => `
    <div class="list-item">
      <span class="list-item-name">
        ${escapeHtml(a.name)} · <span class="list-item-meta">${a.min} мин</span>
      </span>
      <span>
        <span class="list-item-kcal">${Math.round(a.kcal)} ккал</span>
        <button class="btn-remove" data-i="${i}">✕</button>
      </span>
    </div>
  `).join('');

  actListEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.onclick = () => {
      activities.splice(parseInt(btn.dataset.i), 1);
      render();
    };
  });
}

// ============================================
// 7. ЗАКРЫТИЕ ДНЯ
// ============================================

function updateCloseDayBtn() {
  const hasData = foods.length > 0 || activities.length > 0;
  closeDayBtn.disabled = !hasData;
}

function closeDay() {
  if (foods.length === 0 && activities.length === 0) return;

  if (!confirm('Закрыть день? Текущие записи попадут в историю.')) return;

  const eaten   = foods.reduce((sum, f) => sum + f.kcal, 0);
  const burned  = activities.reduce((sum, a) => sum + a.kcal, 0);
  const balance = eaten - burned;

  // ISO-дата YYYY-MM-DD — удобна для сортировки
  const today = new Date();
  const isoDate = today.getFullYear() + '-' +
                  String(today.getMonth() + 1).padStart(2, '0') + '-' +
                  String(today.getDate()).padStart(2, '0');

  // Если запись за сегодня уже есть — заменяем
  history = history.filter(h => h.date !== isoDate);
  history.push({
    date: isoDate,
    eaten: Math.round(eaten),
    burned: Math.round(burned),
    balance: Math.round(balance)
  });

  // Сортируем по дате (старые → новые)
  history.sort((a, b) => a.date.localeCompare(b.date));

  // Чистим текущий день
  foods = [];
  activities = [];

  saveHistory();
  render();
}

// ============================================
// 8. ИСТОРИЯ — отрисовка графика
// ============================================
function renderHistory() {
  if (history.length === 0) {
    historyChart.classList.add('hidden');
    historyEmpty.classList.add('show');
    return;
  }

  historyChart.classList.remove('hidden');
  historyEmpty.classList.remove('show');

  // Берём последние N дней из истории
  const days = history.slice(-chartPeriod);

  // Максимум для масштабирования (не меньше дневной цели)
  const maxValue = Math.max(DAILY_GOAL, ...days.map(d => d.balance));

  historyChart.innerHTML = days.map(d => {
    const value = Math.max(0, d.balance);
    const heightPct = (value / maxValue) * 100;

    let cls = 'chart-bar-fill';
    if (d.balance > DAILY_GOAL) cls += ' over';
    else if (d.balance > DAILY_GOAL * 0.8) cls += ' near';
    else if (d.balance <= 0) cls += ' empty';

    // Короткая подпись даты — день.месяц
    const dateObj = new Date(d.date);
    const label = dateObj.getDate() + '.' + String(dateObj.getMonth() + 1).padStart(2, '0');

    return `
      <div class="chart-bar" title="${d.date}: ${d.balance} ккал (съедено ${d.eaten}, сожжено ${d.burned})">
        <span class="chart-bar-value">${d.balance}</span>
        <div class="${cls}" style="height: ${heightPct}%"></div>
        <span class="chart-bar-label">${label}</span>
      </div>
    `;
  }).join('');
}

// ============================================
// 9. СОХРАНЕНИЕ И ЗАГРУЗКА
// ============================================

function save() {
  const data = {
    date: new Date().toDateString(),
    foods: foods,
    activities: activities
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    if (data.date !== new Date().toDateString()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    foods = data.foods || [];
    activities = data.activities || [];
  } catch (e) {
    console.error('Не удалось загрузить текущий день:', e);
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return;
  try {
    history = JSON.parse(raw) || [];
  } catch (e) {
    console.error('Не удалось загрузить историю:', e);
    history = [];
  }
}

// ============================================
// 10. УТИЛИТА
// ============================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================
// 11. ПРИВЯЗКА СОБЫТИЙ
// ============================================
foodSearch.addEventListener('input', (e) => {
  selectedProduct = null;
  updateCalcPreview();
  showSuggestions(e.target.value);
});

foodSearch.addEventListener('focus', (e) => {
  showSuggestions(e.target.value);
});

foodSearch.addEventListener('blur', () => {
  setTimeout(() => foodSuggest.style.display = 'none', 200);
});

foodGrams.addEventListener('input', updateCalcPreview);

addFoodBtn.addEventListener('click', addFood);
addActBtn.addEventListener('click', addActivity);
closeDayBtn.addEventListener('click', closeDay);

resetBtn.addEventListener('click', () => {
  if (confirm('Сбросить все записи за сегодня? История не пострадает.')) {
    foods = [];
    activities = [];
    render();
  }
});

// Переключатель Неделя / Месяц
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartPeriod = parseInt(btn.dataset.period);
    renderHistory();
  });
});

// ============================================
// 12. СТАРТ
// ============================================
showTodayDate();
load();
loadHistory();
render();
