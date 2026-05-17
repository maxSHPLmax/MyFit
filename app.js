// ============================================
// MyFit — основная логика приложения
// ============================================

// --- Ключи в LocalStorage ---
const STORAGE_KEY        = 'myfit-data';      // текущий день
const HISTORY_KEY        = 'myfit-history';   // архив дней
const GOALS_KEY          = 'myfit-goals';     // цели
const CUSTOM_PRODUCTS_KEY = 'myfit-products'; // свои продукты
const CUSTOM_ACTS_KEY    = 'myfit-acts';      // свои активности

// --- Цели по умолчанию ---
const DEFAULT_GOALS = {
  kcal: 2000,
  protein: 100,
  fat: 70,
  carbs: 250
};

// --- Состояние ---
let foods = [];
let activities = [];
let history = [];
let goals = { ...DEFAULT_GOALS };
let customProducts = [];   // свои продукты
let customActs = [];       // свои активности
let selectedProduct = null;
let chartPeriod = 7;

// --- Хелпер ---
const $ = (id) => document.getElementById(id);

// --- Ссылки на элементы ---
const dateEl       = $('today-date');
const balanceNumEl = $('balance-num');
const eatenNumEl   = $('eaten-num');
const burnedNumEl  = $('burned-num');
const progressBar  = $('progress-bar');
const goalStatus   = $('goal-status');
const goalKcalEl   = $('goal-kcal');

const macroPEl       = $('macro-p');
const macroFEl       = $('macro-f');
const macroCEl       = $('macro-c');
const macroPTargetEl = $('macro-p-target');
const macroFTargetEl = $('macro-f-target');
const macroCTargetEl = $('macro-c-target');

const foodSearch   = $('food-search');
const foodSuggest  = $('food-suggest');
const foodGrams    = $('food-grams');
const foodCalc     = $('food-calc');
const foodListEl   = $('food-list');
const addFoodBtn   = $('add-food-btn');
const newProductBtn = $('new-product-btn');
const newProductForm = $('new-product-form');

const actType      = $('act-type');
const actMin       = $('act-min');
const actListEl    = $('act-list');
const addActBtn    = $('add-act-btn');
const newActivityBtn = $('new-activity-btn');
const newActivityForm = $('new-activity-form');

const closeDayBtn  = $('close-day-btn');
const resetBtn     = $('reset-btn');

const historyChart = $('history-chart');
const historyEmpty = $('history-empty');

const setKcal     = $('set-kcal');
const setProtein  = $('set-protein');
const setFat      = $('set-fat');
const setCarbs    = $('set-carbs');
const settingsSaveBtn = $('settings-save');
const settingsStatus  = $('settings-status');

const myProductsList  = $('my-products-list');
const myProductsEmpty = $('my-products-empty');
const myProductsCount = $('my-products-count');
const editProductForm = $('edit-product-form');

// Индекс редактируемого продукта (null = форма закрыта)
let editingProductIndex = null;

// ============================================
// 1. ДАТА
// ============================================
function showTodayDate() {
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

// ============================================
// 2. ОБЪЕДИНЁННЫЙ СПИСОК ПРОДУКТОВ
// ============================================
// Стандартные + свои; свои помечены custom: true
function getAllProducts() {
  return [
    ...customProducts.map(p => ({ ...p, custom: true })),
    ...PRODUCTS
  ];
}

function getAllActivities() {
  return [
    ...customActs.map(a => ({ ...a, custom: true })),
    ...ACTIVITIES
  ];
}

// ============================================
// 3. ПОИСК ПРОДУКТОВ
// ============================================
function showSuggestions(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    foodSuggest.style.display = 'none';
    return;
  }

  const matches = getAllProducts()
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 6);

  if (matches.length === 0) {
    foodSuggest.innerHTML = '<div class="suggest-empty">Ничего не найдено</div>';
    foodSuggest.style.display = 'block';
    return;
  }

  foodSuggest.innerHTML = matches.map(p => `
    <div class="suggest-item" data-name="${escapeHtml(p.name)}">
      <span>${p.custom ? '<span class="custom-mark">★</span>' : ''}${escapeHtml(p.name)}</span>
      <span class="suggest-meta">${p.kcal100} ккал/100г</span>
    </div>
  `).join('');

  foodSuggest.style.display = 'block';

  foodSuggest.querySelectorAll('.suggest-item').forEach(item => {
    item.onclick = () => {
      const name = item.dataset.name;
      selectedProduct = getAllProducts().find(p => p.name === name);
      foodSearch.value = name;
      foodSuggest.style.display = 'none';
      updateCalcPreview();
      foodGrams.focus();
    };
  });
}

// ============================================
// 4. ПРЕДВАРИТЕЛЬНЫЙ ПОДСЧЁТ
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
// 5. ДОБАВИТЬ ПРОДУКТ
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

  // Считаем порцию (масштабируем со 100 г)
  const k = grams / 100;
  foods.push({
    name: selectedProduct.name,
    grams: grams,
    kcal:    selectedProduct.kcal100 * k,
    protein: (selectedProduct.protein || 0) * k,
    fat:     (selectedProduct.fat     || 0) * k,
    carbs:   (selectedProduct.carbs   || 0) * k
  });

  foodSearch.value = '';
  foodGrams.value = '';
  selectedProduct = null;
  updateCalcPreview();
  render();
}

// ============================================
// 6. ДОБАВИТЬ АКТИВНОСТЬ
// ============================================
function refillActivitySelect() {
  // Очищаем и заполняем заново всеми активностями
  actType.innerHTML = getAllActivities().map(a => {
    const mark = a.custom ? '★ ' : '';
    return `<option value="${a.rate}" data-name="${escapeHtml(a.name)}">${mark}${escapeHtml(a.name)} (${a.rate} ккал/мин)</option>`;
  }).join('');
}

function addActivity() {
  const opt  = actType.options[actType.selectedIndex];
  const rate = parseFloat(opt.value);
  const name = opt.dataset.name;
  const min  = parseFloat(actMin.value);

  if (!min || min <= 0) {
    alert('Укажи количество минут');
    return;
  }

  activities.push({ name, min, kcal: rate * min });
  actMin.value = '';
  render();
}

// ============================================
// 7. ФОРМЫ — свой продукт / своя активность
// ============================================

// Свой продукт
function openProductForm() {
  newProductForm.classList.remove('hidden');
  $('np-name').focus();
}

function closeProductForm() {
  newProductForm.classList.add('hidden');
  ['np-name', 'np-kcal', 'np-protein', 'np-fat', 'np-carbs'].forEach(id => $(id).value = '');
}

function saveNewProduct() {
  const name    = $('np-name').value.trim();
  const kcal100 = parseFloat($('np-kcal').value);
  const protein = parseFloat($('np-protein').value) || 0;
  const fat     = parseFloat($('np-fat').value)     || 0;
  const carbs   = parseFloat($('np-carbs').value)   || 0;

  if (!name) {
    alert('Укажи название');
    return;
  }
  if (!kcal100 || kcal100 < 0) {
    alert('Укажи калорийность');
    return;
  }

  // Проверка дубликата (без учёта регистра)
  const exists = getAllProducts().some(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert('Продукт с таким названием уже есть');
    return;
  }

  customProducts.push({ name, kcal100, protein, fat, carbs });
  saveCustomProducts();
  closeProductForm();
  renderMyProducts();
  alert('Продукт добавлен в твою базу');
}

// ============================================
// МОИ ПРОДУКТЫ — список и редактирование
// ============================================

// Отрисовка списка
function renderMyProducts() {
  myProductsCount.textContent = customProducts.length;

  if (customProducts.length === 0) {
    myProductsList.classList.add('hidden');
    myProductsEmpty.classList.remove('hidden');
    return;
  }

  myProductsList.classList.remove('hidden');
  myProductsEmpty.classList.add('hidden');

  myProductsList.innerHTML = customProducts.map((p, i) => `
    <div class="my-item">
      <div class="my-item-info">
        <div class="my-item-name">${escapeHtml(p.name)}</div>
        <div class="my-item-meta">
          ${p.kcal100} ккал ·
          Б ${p.protein || 0}г ·
          Ж ${p.fat || 0}г ·
          У ${p.carbs || 0}г
        </div>
      </div>
      <div class="my-item-actions">
        <button class="my-item-btn edit" data-i="${i}" title="Редактировать">✏️</button>
        <button class="my-item-btn delete" data-i="${i}" title="Удалить">✕</button>
      </div>
    </div>
  `).join('');

  // Привязка событий к кнопкам
  myProductsList.querySelectorAll('.my-item-btn.edit').forEach(btn => {
    btn.onclick = () => openEditProductForm(parseInt(btn.dataset.i));
  });
  myProductsList.querySelectorAll('.my-item-btn.delete').forEach(btn => {
    btn.onclick = () => deleteMyProduct(parseInt(btn.dataset.i));
  });
}

// Открыть форму редактирования
function openEditProductForm(index) {
  editingProductIndex = index;
  const p = customProducts[index];

  $('ep-name').value    = p.name;
  $('ep-kcal').value    = p.kcal100;
  $('ep-protein').value = p.protein || '';
  $('ep-fat').value     = p.fat || '';
  $('ep-carbs').value   = p.carbs || '';

  editProductForm.classList.remove('hidden');
  $('ep-name').focus();

  // Прокрутим к форме, чтобы её было видно
  editProductForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Закрыть форму редактирования
function closeEditProductForm() {
  editingProductIndex = null;
  editProductForm.classList.add('hidden');
  ['ep-name', 'ep-kcal', 'ep-protein', 'ep-fat', 'ep-carbs'].forEach(id => $(id).value = '');
}

// Сохранить изменения
function saveEditedProduct() {
  if (editingProductIndex === null) return;

  const name    = $('ep-name').value.trim();
  const kcal100 = parseFloat($('ep-kcal').value);
  const protein = parseFloat($('ep-protein').value) || 0;
  const fat     = parseFloat($('ep-fat').value)     || 0;
  const carbs   = parseFloat($('ep-carbs').value)   || 0;

  if (!name) {
    alert('Укажи название');
    return;
  }
  if (!kcal100 || kcal100 < 0) {
    alert('Укажи калорийность');
    return;
  }

  // Проверка дубликата: имя совпадает с другим продуктом (не с собой)
  const lowerName = name.toLowerCase();
  const conflict = getAllProducts().some((p, idx) => {
    // Если это сам редактируемый продукт — пропускаем
    if (p.custom && customProducts[editingProductIndex].name === p.name) return false;
    return p.name.toLowerCase() === lowerName;
  });
  if (conflict) {
    alert('Продукт с таким названием уже есть');
    return;
  }

  // Обновляем продукт
  customProducts[editingProductIndex] = { name, kcal100, protein, fat, carbs };
  saveCustomProducts();
  closeEditProductForm();
  renderMyProducts();
  render(); // обновим списки еды, если этот продукт уже добавлен в дневник
}

// Удалить свой продукт
function deleteMyProduct(index) {
  const p = customProducts[index];
  if (!confirm(`Удалить «${p.name}» из твоей базы?\n\nЗаписи в дневнике питания останутся.`)) return;

  customProducts.splice(index, 1);
  saveCustomProducts();
  renderMyProducts();
}

// Своя активность
function openActivityForm() {
  newActivityForm.classList.remove('hidden');
  $('na-name').focus();
}

function closeActivityForm() {
  newActivityForm.classList.add('hidden');
  $('na-name').value = '';
  $('na-rate').value = '';
}

function saveNewActivity() {
  const name = $('na-name').value.trim();
  const rate = parseFloat($('na-rate').value);

  if (!name) {
    alert('Укажи название');
    return;
  }
  if (!rate || rate <= 0) {
    alert('Укажи расход калорий в минуту');
    return;
  }

  const exists = getAllActivities().some(a => a.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert('Активность с таким названием уже есть');
    return;
  }

  customActs.push({ name, rate });
  saveCustomActs();
  refillActivitySelect();
  closeActivityForm();
  alert('Активность добавлена');
}

// ============================================
// 8. ОТРИСОВКА
// ============================================
function render() {
  save();

  // Суммы по еде
  const eaten   = foods.reduce((s, f) => s + f.kcal, 0);
  const protein = foods.reduce((s, f) => s + (f.protein || 0), 0);
  const fat     = foods.reduce((s, f) => s + (f.fat     || 0), 0);
  const carbs   = foods.reduce((s, f) => s + (f.carbs   || 0), 0);
  const burned  = activities.reduce((s, a) => s + a.kcal, 0);
  const balance = eaten - burned;

  // Числа
  eatenNumEl.textContent   = Math.round(eaten);
  burnedNumEl.textContent  = Math.round(burned);
  balanceNumEl.textContent = Math.round(balance);

  macroPEl.textContent = Math.round(protein);
  macroFEl.textContent = Math.round(fat);
  macroCEl.textContent = Math.round(carbs);

  // Цели в дашборде
  goalKcalEl.textContent     = goals.kcal;
  macroPTargetEl.textContent = goals.protein;
  macroFTargetEl.textContent = goals.fat;
  macroCTargetEl.textContent = goals.carbs;

  // Прогресс-бар по ккал
  const percent = Math.min(100, Math.max(0, (balance / goals.kcal) * 100));
  progressBar.style.width = percent + '%';

  if (balance > goals.kcal) {
    progressBar.style.background = '#e24b4a';
  } else if (balance > goals.kcal * 0.8) {
    progressBar.style.background = '#ef9f27';
  } else {
    progressBar.style.background = '#1d9e75';
  }

  const remaining = goals.kcal - balance;
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
    btn.onclick = () => { foods.splice(parseInt(btn.dataset.i), 1); render(); };
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
    btn.onclick = () => { activities.splice(parseInt(btn.dataset.i), 1); render(); };
  });
}

// ============================================
// 9. ЗАКРЫТИЕ ДНЯ
// ============================================
function updateCloseDayBtn() {
  closeDayBtn.disabled = !(foods.length > 0 || activities.length > 0);
}

function closeDay() {
  if (foods.length === 0 && activities.length === 0) return;
  if (!confirm('Закрыть день? Текущие записи попадут в историю.')) return;

  const eaten   = foods.reduce((s, f) => s + f.kcal, 0);
  const burned  = activities.reduce((s, a) => s + a.kcal, 0);
  const balance = eaten - burned;
  // Считаем БЖУ за день
  const protein = foods.reduce((s, f) => s + (f.protein || 0), 0);
  const fat     = foods.reduce((s, f) => s + (f.fat     || 0), 0);
  const carbs   = foods.reduce((s, f) => s + (f.carbs   || 0), 0);

  const today = new Date();
  const isoDate = today.getFullYear() + '-' +
                  String(today.getMonth() + 1).padStart(2, '0') + '-' +
                  String(today.getDate()).padStart(2, '0');

  history = history.filter(h => h.date !== isoDate);
  history.push({
    date: isoDate,
    eaten: Math.round(eaten),
    burned: Math.round(burned),
    balance: Math.round(balance),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs)
  });
  history.sort((a, b) => a.date.localeCompare(b.date));

  foods = [];
  activities = [];
  saveHistory();
  render();
}

// ============================================
// 10. ИСТОРИЯ — графики (калории + БЖУ)
// ============================================
function renderHistory() {
  const macrosChart = $('history-chart-macros');

  if (history.length === 0) {
    historyChart.classList.add('hidden');
    macrosChart.classList.add('hidden');
    historyEmpty.classList.add('show');
    return;
  }

  historyChart.classList.remove('hidden');
  macrosChart.classList.remove('hidden');
  historyEmpty.classList.remove('show');

  const days = history.slice(-chartPeriod);

  // --- ГРАФИК 1: КАЛОРИИ ---
  const maxKcal = Math.max(goals.kcal, ...days.map(d => d.balance));

  historyChart.innerHTML = days.map(d => {
    const value = Math.max(0, d.balance);
    const heightPct = (value / maxKcal) * 100;

    let cls = 'chart-bar-fill';
    if (d.balance > goals.kcal) cls += ' over';
    else if (d.balance > goals.kcal * 0.8) cls += ' near';
    else if (d.balance <= 0) cls += ' empty';

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

  // --- ГРАФИК 2: БЖУ ---
  renderMacrosChart(days, macrosChart);
}

function renderMacrosChart(days, container) {
  // Максимум среди всех значений Б/Ж/У и среди целей — чтобы масштаб был общим
  const allValues = days.flatMap(d => [d.protein || 0, d.fat || 0, d.carbs || 0]);
  const maxMacro = Math.max(goals.protein, goals.fat, goals.carbs, ...allValues, 1);

  container.innerHTML = days.map(d => {
    const dateObj = new Date(d.date);
    const label = dateObj.getDate() + '.' + String(dateObj.getMonth() + 1).padStart(2, '0');

    // Если в этом дне нет БЖУ — показываем пропуск
    const hasMacros = (d.protein !== undefined || d.fat !== undefined || d.carbs !== undefined);

    if (!hasMacros) {
      return `
        <div class="chart-bar chart-bar-macros chart-bar-skip" title="${d.date}: данных по БЖУ нет">
          <div class="macros-group">
            <div class="macro-bar empty-bar"></div>
          </div>
          <span class="chart-bar-label">${label}</span>
        </div>
      `;
    }

    const p = d.protein || 0;
    const f = d.fat || 0;
    const c = d.carbs || 0;

    const pHeight = (p / maxMacro) * 100;
    const fHeight = (f / maxMacro) * 100;
    const cHeight = (c / maxMacro) * 100;

    return `
      <div class="chart-bar chart-bar-macros" title="${d.date}: Б ${p}г · Ж ${f}г · У ${c}г">
        <div class="macros-group">
          <div class="macro-bar macro-bar-p" style="height: ${pHeight}%" title="Белки ${p}г"></div>
          <div class="macro-bar macro-bar-f" style="height: ${fHeight}%" title="Жиры ${f}г"></div>
          <div class="macro-bar macro-bar-c" style="height: ${cHeight}%" title="Углеводы ${c}г"></div>
        </div>
        <span class="chart-bar-label">${label}</span>
      </div>
    `;
  }).join('');
}

// ============================================
// 11. НАСТРОЙКИ — цели
// ============================================
function loadGoalsIntoForm() {
  setKcal.value    = goals.kcal;
  setProtein.value = goals.protein;
  setFat.value     = goals.fat;
  setCarbs.value   = goals.carbs;
}

function saveSettings() {
  const kcal    = parseFloat(setKcal.value);
  const protein = parseFloat(setProtein.value);
  const fat     = parseFloat(setFat.value);
  const carbs   = parseFloat(setCarbs.value);

  if (!kcal || kcal <= 0 || !protein || protein < 0 || !fat || fat < 0 || !carbs || carbs < 0) {
    alert('Все поля должны быть положительными числами');
    return;
  }

  goals = { kcal, protein, fat, carbs };
  saveGoals();
  render();

  settingsStatus.textContent = '✓ Цели сохранены';
  settingsStatus.classList.add('show');
  setTimeout(() => settingsStatus.classList.remove('show'), 2000);
}

// ============================================
// 12. СОХРАНЕНИЕ И ЗАГРУЗКА
// ============================================
function save() {
  const data = { date: new Date().toDateString(), foods, activities };
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
  } catch (e) { console.error('Не удалось загрузить день:', e); }
}

function saveHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return;
  try { history = JSON.parse(raw) || []; }
  catch (e) { history = []; console.error('Не удалось загрузить историю:', e); }
}

function saveGoals() { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); }

function loadGoals() {
  const raw = localStorage.getItem(GOALS_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    goals = { ...DEFAULT_GOALS, ...data };
  } catch (e) { console.error('Не удалось загрузить цели:', e); }
}

function saveCustomProducts() { localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(customProducts)); }

function loadCustomProducts() {
  const raw = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
  if (!raw) return;
  try { customProducts = JSON.parse(raw) || []; }
  catch (e) { customProducts = []; }
}

function saveCustomActs() { localStorage.setItem(CUSTOM_ACTS_KEY, JSON.stringify(customActs)); }

function loadCustomActs() {
  const raw = localStorage.getItem(CUSTOM_ACTS_KEY);
  if (!raw) return;
  try { customActs = JSON.parse(raw) || []; }
  catch (e) { customActs = []; }
}

// ============================================
// 13. УТИЛИТА
// ============================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ============================================
// 14. СОБЫТИЯ
// ============================================
foodSearch.addEventListener('input', (e) => {
  selectedProduct = null;
  updateCalcPreview();
  showSuggestions(e.target.value);
});
foodSearch.addEventListener('focus', (e) => showSuggestions(e.target.value));
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

// Формы «своих»
newProductBtn.addEventListener('click', openProductForm);
$('np-cancel').addEventListener('click', closeProductForm);
$('np-save').addEventListener('click', saveNewProduct);

newActivityBtn.addEventListener('click', openActivityForm);
$('na-cancel').addEventListener('click', closeActivityForm);
$('na-save').addEventListener('click', saveNewActivity);

// Форма редактирования «моих продуктов»
$('ep-cancel').addEventListener('click', closeEditProductForm);
$('ep-save').addEventListener('click', saveEditedProduct);

// Настройки
settingsSaveBtn.addEventListener('click', saveSettings);

// Период истории
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartPeriod = parseInt(btn.dataset.period);
    renderHistory();
  });
});

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ============================================

// Названия экранов для заголовка в шапке
const TAB_TITLES = {
  diary:    'MyFit',
  history:  'История',
  products: 'Мои продукты',
  settings: 'Настройки'
};

function switchTab(tabName) {
  // Скрыть все экраны и снять активность с кнопок
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  // Показать нужный экран
  const screen = document.getElementById('screen-' + tabName);
  if (screen) screen.classList.add('active');

  // Подсветить кнопку
  const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Обновить заголовок
  document.getElementById('screen-title').textContent = TAB_TITLES[tabName] || 'MyFit';

  // Прокрутить страницу наверх
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ============================================
// 15. СТАРТ
// ============================================
showTodayDate();
loadGoals();
loadCustomProducts();
loadCustomActs();
loadHistory();
load();

refillActivitySelect();
loadGoalsIntoForm();
renderMyProducts();
render();
