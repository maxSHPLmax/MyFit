// ============================================
// MyFit — основная логика приложения
// ============================================

// --- Настройки ---
const DAILY_GOAL = 2000; // дневная цель в ккал

// --- Состояние приложения (что добавлено за день) ---
let foods = [];           // массив съеденных продуктов
let activities = [];      // массив активностей
let selectedProduct = null; // выбранный продукт из подсказок

// --- Получаем ссылки на элементы страницы ---
const $ = (id) => document.getElementById(id); // короткий хелпер

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

const resetBtn     = $('reset-btn');

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

// Показать подсказки при вводе текста
function showSuggestions(query) {
  const q = query.trim().toLowerCase();

  // Если пусто — скрываем
  if (!q) {
    foodSuggest.style.display = 'none';
    return;
  }

  // Ищем совпадения (не больше 6 штук)
  const matches = PRODUCTS
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 6);

  // Ничего не нашли
  if (matches.length === 0) {
    foodSuggest.innerHTML = '<div class="suggest-empty">Ничего не найдено</div>';
    foodSuggest.style.display = 'block';
    return;
  }

  // Строим HTML списка подсказок
  foodSuggest.innerHTML = matches.map(p => `
    <div class="suggest-item" data-name="${escapeHtml(p.name)}">
      <span>${escapeHtml(p.name)}</span>
      <span class="suggest-meta">${p.kcal100} ккал/100г</span>
    </div>
  `).join('');

  foodSuggest.style.display = 'block';

  // Вешаем клик на каждую подсказку
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
// Показывает, сколько ккал будет, когда вводишь граммы
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

  // Считаем калории
  const kcal = (selectedProduct.kcal100 * grams) / 100;

  // Добавляем в массив
  foods.push({
    name: selectedProduct.name,
    grams: grams,
    kcal: kcal
  });

  // Чистим поля
  foodSearch.value = '';
  foodGrams.value = '';
  selectedProduct = null;
  updateCalcPreview();

  // Перерисовываем
  render();
}

// ============================================
// 5. ДОБАВЛЕНИЕ АКТИВНОСТИ
// ============================================
function addActivity() {
  const rate = parseFloat(actType.value); // ккал в минуту
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
// 6. ОТРИСОВКА (главный пересчёт всего экрана)
// ============================================
function render() {
  // Считаем суммы
  const eaten   = foods.reduce((sum, f) => sum + f.kcal, 0);
  const burned  = activities.reduce((sum, a) => sum + a.kcal, 0);
  const balance = eaten - burned;

  // Обновляем числа на экране
  eatenNumEl.textContent   = Math.round(eaten);
  burnedNumEl.textContent  = Math.round(burned);
  balanceNumEl.textContent = Math.round(balance);

  // Прогресс-бар
  const percent = Math.min(100, Math.max(0, (balance / DAILY_GOAL) * 100));
  progressBar.style.width = percent + '%';

  // Цвет в зависимости от близости к цели
  if (balance > DAILY_GOAL) {
    progressBar.style.background = '#e24b4a';      // красный — превышение
  } else if (balance > DAILY_GOAL * 0.8) {
    progressBar.style.background = '#ef9f27';      // оранжевый — близко к цели
  } else {
    progressBar.style.background = '#1d9e75';      // зелёный
  }

  // Сообщение о статусе цели
  const remaining = DAILY_GOAL - balance;
  if (foods.length === 0 && activities.length === 0) {
    goalStatus.textContent = 'Добавь продукт ниже ↓';
  } else if (remaining > 0) {
    goalStatus.textContent = `Осталось ${Math.round(remaining)} ккал до цели`;
  } else {
    goalStatus.textContent = `Цель достигнута! Превышение: ${Math.round(-remaining)} ккал`;
  }

  // Списки
  renderFoodList();
  renderActivityList();
}

// Список продуктов
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

  // Кнопки удаления
  foodListEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.onclick = () => {
      foods.splice(parseInt(btn.dataset.i), 1);
      render();
    };
  });
}

// Список активностей
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
// 7. УТИЛИТА: защита от HTML в названиях
// ============================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================
// 8. ПРИВЯЗКА СОБЫТИЙ
// ============================================

// Поиск продуктов
foodSearch.addEventListener('input', (e) => {
  selectedProduct = null;
  updateCalcPreview();
  showSuggestions(e.target.value);
});

foodSearch.addEventListener('focus', (e) => {
  showSuggestions(e.target.value);
});

foodSearch.addEventListener('blur', () => {
  // Небольшая задержка, чтобы успел сработать клик по подсказке
  setTimeout(() => foodSuggest.style.display = 'none', 200);
});

foodGrams.addEventListener('input', updateCalcPreview);

// Кнопки
addFoodBtn.addEventListener('click', addFood);
addActBtn.addEventListener('click', addActivity);

resetBtn.addEventListener('click', () => {
  if (confirm('Сбросить все записи за сегодня?')) {
    foods = [];
    activities = [];
    render();
  }
});

// ============================================
// 9. СТАРТ
// ============================================
showTodayDate();
render();
