// ============================================
// MyFit — основная логика приложения
// ============================================

// --- Ключи в LocalStorage ---
const STORAGE_KEY        = 'myfit-data';      // текущий день
const HISTORY_KEY        = 'myfit-history';   // архив дней
const GOALS_KEY          = 'myfit-goals';     // цели
const CUSTOM_PRODUCTS_KEY = 'myfit-products'; // свои продукты
const CUSTOM_ACTS_KEY    = 'myfit-acts';      // свои активности
const PLAN_KEY           = 'myfit-plan';      // план питания по дням недели
const MEALS_DONE_KEY     = 'myfit-meals-done'; // отмеченные приёмы сегодня
const NOTIF_SETTINGS_KEY = 'myfit-notif';      // настройки напоминаний
const NOTIF_SHOWN_KEY    = 'myfit-notif-shown'; // какие уведомления уже показывали сегодня

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

// План питания: один объект, ключи = дни недели
let plan = {
  monday: [], tuesday: [], wednesday: [], thursday: [],
  friday: [], saturday: [], sunday: []
};
// ID последнего приёма (для уникальности)
let nextMealId = 1;

// Какие приёмы сегодня отмечены съеденными
let mealsDone = { date: '', doneMealIds: [] };

// Состояние редактора плана
let planSelectedDay = null;       // какой день недели сейчас открыт
let editingMeal = null;           // редактируемый/создаваемый приём
let mealProductSelected = null;   // выбранный продукт в форме приёма
let copyFromDay = null;           // день, из которого копируем

// Настройки напоминаний
let notifSettings = {
  enabled: false,
  offsetMin: 0  // за сколько минут до приёма
};
// Какие приёмы уже получили уведомление сегодня (чтобы не дублировать)
let notifShown = { date: '', shownMealIds: [] };

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

// ============================================
// ПЛАН ПИТАНИЯ
// ============================================

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_NAMES = {
  monday: 'понедельник', tuesday: 'вторник', wednesday: 'среда',
  thursday: 'четверг', friday: 'пятница', saturday: 'суббота', sunday: 'воскресенье'
};

// Вычислить день недели для строкового ключа
function getTodayKey() {
  return WEEKDAYS[new Date().getDay()];
}

// Подсчёт калорий и БЖУ для приёма пищи
function calcMealTotals(meal) {
  let kcal = 0, protein = 0, fat = 0, carbs = 0;
  for (const item of meal.items) {
    const p = getAllProducts().find(prod => prod.name === item.productName);
    if (!p) continue;
    const k = item.grams / 100;
    kcal    += p.kcal100 * k;
    protein += (p.protein || 0) * k;
    fat     += (p.fat || 0) * k;
    carbs   += (p.carbs || 0) * k;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs)
  };
}

// Отрисовка экрана «План»
function renderPlanScreen() {
  // Подсветка кнопок дней недели
  document.querySelectorAll('#weekday-switch .weekday-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === planSelectedDay);
    btn.classList.toggle('today', btn.dataset.day === getTodayKey());
  });

  const meals = plan[planSelectedDay] || [];
  const listEl  = $('plan-meals-list');
  const emptyEl = $('plan-empty');

  if (meals.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = meals.map((meal, i) => {
    const totals = calcMealTotals(meal);
    const itemsText = meal.items.length
      ? meal.items.map(it => `${escapeHtml(it.productName)} ${it.grams}г`).join(', ')
      : '<i>пусто</i>';
    const timeHtml = meal.time ? `<span class="plan-meal-time">⏰ ${meal.time}</span>` : '';

    return `
      <div class="plan-meal">
        <div class="plan-meal-header">
          <div>
            <div class="plan-meal-name">${timeHtml}${escapeHtml(meal.name)}</div>
            <div class="plan-meal-meta">${totals.kcal} ккал · Б ${totals.protein} · Ж ${totals.fat} · У ${totals.carbs}</div>
          </div>
          <div class="plan-meal-actions">
            <button class="my-item-btn" data-action="edit" data-i="${i}" title="Редактировать">✏️</button>
            <button class="my-item-btn delete" data-action="delete" data-i="${i}" title="Удалить">✕</button>
          </div>
        </div>
        <div class="plan-meal-items">${itemsText}</div>
      </div>
    `;
  }).join('');

  // Привязка событий
  listEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.onclick = () => openMealForm(parseInt(btn.dataset.i));
  });
  listEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.onclick = () => deleteMeal(parseInt(btn.dataset.i));
  });
}

// Открыть форму создания нового приёма
function openMealForm(editIndex = null) {
  editingMeal = editIndex === null
    ? { id: nextMealId++, name: '', items: [], time: '' }
    : JSON.parse(JSON.stringify(plan[planSelectedDay][editIndex]));
  // Запомним индекс для сохранения
  editingMeal._editIndex = editIndex;

  $('meal-form-title').textContent = editIndex === null ? 'Новый приём пищи' : 'Редактировать приём';
  $('meal-name').value = editingMeal.name;
  $('meal-time').value = editingMeal.time || '';
  $('meal-product-search').value = '';
  $('meal-product-grams').value = '';
  mealProductSelected = null;

  renderMealItems();
  $('meal-form').classList.remove('hidden');
  $('meal-name').focus();
}

function closeMealForm() {
  editingMeal = null;
  $('meal-form').classList.add('hidden');
  $('meal-product-suggest').style.display = 'none';
}

// Список продуктов внутри редактируемого приёма
function renderMealItems() {
  const listEl = $('meal-items-list');
  if (!editingMeal || editingMeal.items.length === 0) {
    listEl.innerHTML = '<p style="font-size:11px;color:#888780;padding:6px 0;">Добавь продукты ниже</p>';
    return;
  }
  listEl.innerHTML = editingMeal.items.map((it, i) => `
    <div class="meal-item">
      <span class="meal-item-name">${escapeHtml(it.productName)}</span>
      <span class="meal-item-grams">${it.grams} г</span>
      <button class="btn-remove" data-i="${i}">✕</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.onclick = () => {
      editingMeal.items.splice(parseInt(btn.dataset.i), 1);
      renderMealItems();
    };
  });
}

// Подсказки продуктов внутри формы приёма
function showMealProductSuggestions(query) {
  const suggestEl = $('meal-product-suggest');
  const q = query.trim().toLowerCase();
  if (!q) { suggestEl.style.display = 'none'; return; }

  const matches = getAllProducts()
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 6);

  if (matches.length === 0) {
    suggestEl.innerHTML = '<div class="suggest-empty">Ничего не найдено</div>';
    suggestEl.style.display = 'block';
    return;
  }

  suggestEl.innerHTML = matches.map(p => `
    <div class="suggest-item" data-name="${escapeHtml(p.name)}">
      <span>${p.custom ? '<span class="custom-mark">★</span>' : ''}${escapeHtml(p.name)}</span>
      <span class="suggest-meta">${p.kcal100} ккал/100г</span>
    </div>
  `).join('');
  suggestEl.style.display = 'block';

  suggestEl.querySelectorAll('.suggest-item').forEach(item => {
    item.onclick = () => {
      mealProductSelected = getAllProducts().find(p => p.name === item.dataset.name);
      $('meal-product-search').value = item.dataset.name;
      suggestEl.style.display = 'none';
      $('meal-product-grams').focus();
    };
  });
}

// Добавить продукт в редактируемый приём
function addProductToMeal() {
  if (!mealProductSelected) { alert('Выбери продукт из списка'); return; }
  const grams = parseFloat($('meal-product-grams').value);
  if (!grams || grams <= 0) { alert('Укажи вес'); return; }

  editingMeal.items.push({ productName: mealProductSelected.name, grams });
  $('meal-product-search').value = '';
  $('meal-product-grams').value = '';
  mealProductSelected = null;
  renderMealItems();
  $('meal-product-search').focus();
}

// Сохранить приём (новый или редактируемый)
function saveMeal() {
  const name = $('meal-name').value.trim();
  if (!name) { alert('Укажи название приёма'); return; }
  if (editingMeal.items.length === 0) { alert('Добавь хотя бы один продукт'); return; }

  editingMeal.name = name;
  editingMeal.time = $('meal-time').value || '';  // опциональное поле
  const editIndex = editingMeal._editIndex;
  delete editingMeal._editIndex;

  if (editIndex === null) {
    plan[planSelectedDay].push(editingMeal);
  } else {
    plan[planSelectedDay][editIndex] = editingMeal;
  }

  // Сортируем приёмы по времени (без времени — в конец)
  plan[planSelectedDay].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  savePlan();
  closeMealForm();
  renderPlanScreen();
  render(); // обновим блок «План на сегодня» в дневнике
}

// Удалить приём
function deleteMeal(index) {
  const meal = plan[planSelectedDay][index];
  if (!confirm(`Удалить приём «${meal.name}»?`)) return;
  plan[planSelectedDay].splice(index, 1);
  savePlan();
  renderPlanScreen();
  render();
}

// Копирование плана из другого дня
function openCopyForm() {
  copyFromDay = null;
  document.querySelectorAll('#copy-from-switch .weekday-btn').forEach(b => b.classList.remove('active'));
  $('copy-plan-form').classList.remove('hidden');
}

function closeCopyForm() {
  $('copy-plan-form').classList.add('hidden');
}

function applyCopyPlan() {
  if (!copyFromDay) { alert('Выбери день, из которого копировать'); return; }
  if (copyFromDay === planSelectedDay) { alert('Это тот же самый день'); return; }
  if (plan[planSelectedDay].length > 0) {
    if (!confirm(`Заменить ${plan[planSelectedDay].length} приём(ов) из «${WEEKDAY_NAMES[planSelectedDay]}» на план из «${WEEKDAY_NAMES[copyFromDay]}»?`)) return;
  }
  // Глубокая копия с новыми id
  plan[planSelectedDay] = plan[copyFromDay].map(m => ({
    id: nextMealId++,
    name: m.name,
    items: m.items.map(it => ({ ...it }))
  }));
  savePlan();
  closeCopyForm();
  renderPlanScreen();
  render();
}

// ============================================
// ПЛАН НА СЕГОДНЯ — отображение в Дневнике
// ============================================
function renderTodayPlan() {
  const todayKey = getTodayKey();
  const meals = plan[todayKey] || [];
  const listEl  = $('today-plan-list');
  const emptyEl = $('today-plan-empty');
  const dayEl   = $('today-plan-day');

  dayEl.textContent = WEEKDAY_NAMES[todayKey];

  if (meals.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';

  // Текущее время в формате "HH:MM"
  const now = new Date();
  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  listEl.innerHTML = meals.map(meal => {
    const totals = calcMealTotals(meal);
    const isDone = mealsDone.doneMealIds.includes(meal.id);
    const itemsText = meal.items.map(it => `${escapeHtml(it.productName)} ${it.grams}г`).join(', ');
    const timeHtml = meal.time ? `<span class="today-meal-time">⏰ ${meal.time}</span>` : '';

    // Приём считается «пропущенным», если время прошло, есть время, и не отмечен
    const isMissed = meal.time && !isDone && meal.time < currentTime;

    let cls = 'today-meal';
    if (isDone) cls += ' done';
    else if (isMissed) cls += ' missed';

    return `
      <div class="${cls}">
        <div class="today-meal-row">
          <div class="today-meal-info">
            <div class="today-meal-name">${timeHtml}${isDone ? '✓ ' : (isMissed ? '⚠️ ' : '')}${escapeHtml(meal.name)}</div>
            <div class="today-meal-meta">${totals.kcal} ккал · Б ${totals.protein} · Ж ${totals.fat} · У ${totals.carbs}</div>
          </div>
          <button class="btn-eat ${isDone ? 'done' : ''}" data-meal-id="${meal.id}">
            ${isDone ? 'Отменить' : '✓ Съел'}
          </button>
        </div>
        <div class="today-meal-items">${itemsText}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-eat').forEach(btn => {
    btn.onclick = () => toggleMealEaten(parseInt(btn.dataset.mealId));
  });
}

// Отметить/снять отметку приёма пищи
function toggleMealEaten(mealId) {
  const todayKey = getTodayKey();
  const meal = (plan[todayKey] || []).find(m => m.id === mealId);
  if (!meal) return;

  const isDone = mealsDone.doneMealIds.includes(mealId);

  if (isDone) {
    // Снимаем отметку — удаляем продукты, добавленные из этого приёма
    foods = foods.filter(f => f._fromMealId !== mealId);
    mealsDone.doneMealIds = mealsDone.doneMealIds.filter(id => id !== mealId);
  } else {
    // Добавляем продукты приёма в дневник
    for (const item of meal.items) {
      const p = getAllProducts().find(prod => prod.name === item.productName);
      if (!p) continue;
      const k = item.grams / 100;
      foods.push({
        name: p.name,
        grams: item.grams,
        kcal: p.kcal100 * k,
        protein: (p.protein || 0) * k,
        fat:     (p.fat || 0)     * k,
        carbs:   (p.carbs || 0)   * k,
        _fromMealId: mealId       // метка, чтобы потом можно было отменить
      });
    }
    mealsDone.doneMealIds.push(mealId);
  }

  saveMealsDone();
  render();
}

// ============================================
// СОХРАНЕНИЕ / ЗАГРУЗКА ПЛАНА
// ============================================
function savePlan() {
  localStorage.setItem(PLAN_KEY, JSON.stringify({ plan, nextMealId }));
}

function loadPlan() {
  const raw = localStorage.getItem(PLAN_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    plan = data.plan || plan;
    nextMealId = data.nextMealId || 1;
  } catch (e) { console.error('Не удалось загрузить план:', e); }
}

function saveMealsDone() {
  localStorage.setItem(MEALS_DONE_KEY, JSON.stringify(mealsDone));
}

function loadMealsDone() {
  const raw = localStorage.getItem(MEALS_DONE_KEY);
  if (!raw) { mealsDone = { date: new Date().toDateString(), doneMealIds: [] }; return; }
  try {
    const data = JSON.parse(raw);
    // Если данные за другой день — сбрасываем
    if (data.date !== new Date().toDateString()) {
      mealsDone = { date: new Date().toDateString(), doneMealIds: [] };
      saveMealsDone();
    } else {
      mealsDone = data;
    }
  } catch (e) {
    mealsDone = { date: new Date().toDateString(), doneMealIds: [] };
  }
}

// ============================================
// НАПОМИНАНИЯ — Notifications API
// ============================================

function saveNotifSettings() {
  localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(notifSettings));
}

function loadNotifSettings() {
  const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
  if (!raw) return;
  try { notifSettings = { ...notifSettings, ...JSON.parse(raw) }; }
  catch (e) { console.error('Не удалось загрузить настройки напоминаний:', e); }
}

function saveNotifShown() {
  localStorage.setItem(NOTIF_SHOWN_KEY, JSON.stringify(notifShown));
}

function loadNotifShown() {
  const raw = localStorage.getItem(NOTIF_SHOWN_KEY);
  if (!raw) { notifShown = { date: new Date().toDateString(), shownMealIds: [] }; return; }
  try {
    const data = JSON.parse(raw);
    // Сбрасываем при новом дне
    if (data.date !== new Date().toDateString()) {
      notifShown = { date: new Date().toDateString(), shownMealIds: [] };
      saveNotifShown();
    } else {
      notifShown = data;
    }
  } catch (e) {
    notifShown = { date: new Date().toDateString(), shownMealIds: [] };
  }
}

// Обновить UI с информацией о разрешении на уведомления
function updateNotifPermissionInfo() {
  const infoEl = $('notif-permission-info');
  const reqBtn = $('notif-request');
  const testBtn = $('notif-test');

  if (!('Notification' in window)) {
    infoEl.textContent = '⚠️ Браузер не поддерживает уведомления';
    infoEl.className = 'notif-info error';
    reqBtn.style.display = 'none';
    testBtn.style.display = 'none';
    return;
  }

  switch (Notification.permission) {
    case 'granted':
      infoEl.textContent = '✓ Уведомления разрешены';
      infoEl.className = 'notif-info success';
      reqBtn.style.display = 'none';
      testBtn.style.display = 'block';
      break;
    case 'denied':
      infoEl.innerHTML = '✕ Уведомления заблокированы. Чтобы включить — открой настройки сайта в браузере и разреши уведомления для этой страницы.';
      infoEl.className = 'notif-info error';
      reqBtn.style.display = 'none';
      testBtn.style.display = 'none';
      break;
    default:
      infoEl.textContent = 'Нажми кнопку, чтобы разрешить уведомления.';
      infoEl.className = 'notif-info';
      reqBtn.style.display = 'block';
      testBtn.style.display = 'none';
  }
}

// Запросить разрешение на уведомления
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Браузер не поддерживает уведомления');
    return;
  }
  try {
    const result = await Notification.requestPermission();
    updateNotifPermissionInfo();
    if (result === 'granted') {
      // Сразу включаем
      notifSettings.enabled = true;
      $('notif-enabled').checked = true;
      saveNotifSettings();
    }
  } catch (e) {
    console.error('Ошибка запроса разрешения:', e);
  }
}

// Показать уведомление
function showMealNotification(meal) {
  if (Notification.permission !== 'granted') return;

  const itemsText = meal.items.map(it => `${it.productName} ${it.grams}г`).join(', ');
  const title = `🍽 ${meal.name} — пора есть!`;

  // Если установлен Service Worker, используем его (для надёжности на мобильных)
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body: itemsText + (meal.time ? `\nЗапланировано на ${meal.time}` : ''),
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: 'meal-' + meal.id,
        requireInteraction: false,
        data: { mealId: meal.id }
      });
    });
  } else {
    // Фоллбэк через обычные Notifications
    new Notification(title, {
      body: itemsText,
      icon: 'icon-192.png'
    });
  }
}

// Проверка приёмов: пора ли показать уведомление?
function checkNotifications() {
  if (!notifSettings.enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Обновляем notifShown, если новый день
  if (notifShown.date !== new Date().toDateString()) {
    notifShown = { date: new Date().toDateString(), shownMealIds: [] };
    saveNotifShown();
  }

  const todayKey = getTodayKey();
  const meals = plan[todayKey] || [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const meal of meals) {
    if (!meal.time) continue;                                  // нет времени
    if (mealsDone.doneMealIds.includes(meal.id)) continue;     // уже съел
    if (notifShown.shownMealIds.includes(meal.id)) continue;   // уже показывали

    // Время приёма в минутах от полуночи
    const [h, m] = meal.time.split(':').map(Number);
    const mealMinutes = h * 60 + m;
    const triggerMinutes = mealMinutes - notifSettings.offsetMin;

    // Показываем, если текущее время >= момента триггера, но не позже чем через 5 минут после
    if (nowMinutes >= triggerMinutes && nowMinutes <= triggerMinutes + 5) {
      showMealNotification(meal);
      notifShown.shownMealIds.push(meal.id);
      saveNotifShown();
    }
  }
}

// Тестовое уведомление
function showTestNotification() {
  if (Notification.permission !== 'granted') {
    alert('Сначала разреши уведомления');
    return;
  }
  showMealNotification({
    id: 'test',
    name: 'Тестовое уведомление',
    time: new Date().toTimeString().slice(0, 5),
    items: [{ productName: 'Это тест', grams: 100 }]
  });
}

// Загрузить настройки в форму
function loadNotifSettingsIntoForm() {
  $('notif-enabled').checked = notifSettings.enabled;
  $('notif-offset').value = String(notifSettings.offsetMin);
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
  renderTodayPlan();
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
  mealsDone = { date: new Date().toDateString(), doneMealIds: [] };
  saveHistory();
  saveMealsDone();
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
    mealsDone = { date: new Date().toDateString(), doneMealIds: [] };
    saveMealsDone();
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
  plan:     'План питания',
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

  // При открытии плана — показать сегодняшний день
  if (tabName === 'plan') {
    if (!planSelectedDay) planSelectedDay = getTodayKey();
    renderPlanScreen();
  }

  // Прокрутить страницу наверх
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ============================================
// СОБЫТИЯ ПЛАНА
// ============================================

// Переключение дней недели в Плане
document.querySelectorAll('#weekday-switch .weekday-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    planSelectedDay = btn.dataset.day;
    renderPlanScreen();
  });
});

// Кнопка добавить приём
$('add-meal-btn').addEventListener('click', () => openMealForm(null));

// Форма приёма пищи
$('meal-cancel').addEventListener('click', closeMealForm);
$('meal-save').addEventListener('click', saveMeal);
$('meal-product-add').addEventListener('click', addProductToMeal);

// Поиск продукта внутри формы приёма
$('meal-product-search').addEventListener('input', (e) => {
  mealProductSelected = null;
  showMealProductSuggestions(e.target.value);
});
$('meal-product-search').addEventListener('focus', (e) => showMealProductSuggestions(e.target.value));
$('meal-product-search').addEventListener('blur', () => {
  setTimeout(() => $('meal-product-suggest').style.display = 'none', 200);
});

// Копирование плана
$('copy-plan-btn').addEventListener('click', openCopyForm);
$('copy-cancel').addEventListener('click', closeCopyForm);
$('copy-apply').addEventListener('click', applyCopyPlan);

document.querySelectorAll('#copy-from-switch .weekday-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    copyFromDay = btn.dataset.day;
    document.querySelectorAll('#copy-from-switch .weekday-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Очистить поле времени в форме приёма
$('meal-time-clear').addEventListener('click', () => {
  $('meal-time').value = '';
});

// ============================================
// СОБЫТИЯ НАПОМИНАНИЙ
// ============================================
$('notif-enabled').addEventListener('change', (e) => {
  notifSettings.enabled = e.target.checked;
  saveNotifSettings();

  // Если включили, но разрешения нет — сразу запросим
  if (notifSettings.enabled && 'Notification' in window && Notification.permission === 'default') {
    requestNotificationPermission();
  }
});

$('notif-offset').addEventListener('change', (e) => {
  notifSettings.offsetMin = parseInt(e.target.value);
  saveNotifSettings();
  // Сбрасываем «уже показанные» — может, теперь триггер ещё не сработал
  notifShown.shownMealIds = [];
  saveNotifShown();
});

$('notif-request').addEventListener('click', requestNotificationPermission);
$('notif-test').addEventListener('click', showTestNotification);

// ============================================
// 15. СТАРТ
// ============================================
showTodayDate();
loadGoals();
loadCustomProducts();
loadCustomActs();
loadHistory();
loadPlan();
loadMealsDone();
loadNotifSettings();
loadNotifShown();
load();

refillActivitySelect();
loadGoalsIntoForm();
loadNotifSettingsIntoForm();
updateNotifPermissionInfo();
renderMyProducts();
render();

// Запускаем проверку напоминаний каждую минуту
// (плюс одна сразу при старте — на случай пропущенных)
checkNotifications();
setInterval(checkNotifications, 60 * 1000);

// Также обновляем «пропущенные» приёмы (подсветка) каждую минуту
setInterval(() => {
  // Только если открыт Дневник
  if (document.getElementById('screen-diary').classList.contains('active')) {
    renderTodayPlan();
  }
}, 60 * 1000);
