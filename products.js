// ============================================
// База продуктов
// На 100 г: ккал, белки, жиры, углеводы (в граммах)
// ============================================

const PRODUCTS = [
  // Фрукты
  { name: 'Яблоко',                       kcal100: 52,  protein: 0.3,  fat: 0.2,  carbs: 14.0 },
  { name: 'Банан',                        kcal100: 89,  protein: 1.1,  fat: 0.3,  carbs: 23.0 },
  { name: 'Апельсин',                     kcal100: 47,  protein: 0.9,  fat: 0.1,  carbs: 12.0 },
  { name: 'Груша',                        kcal100: 57,  protein: 0.4,  fat: 0.1,  carbs: 15.0 },
  { name: 'Виноград',                     kcal100: 69,  protein: 0.7,  fat: 0.2,  carbs: 18.0 },
  { name: 'Клубника',                     kcal100: 32,  protein: 0.7,  fat: 0.3,  carbs: 7.7  },

  // Крупы
  { name: 'Овсянка (сухая)',              kcal100: 389, protein: 16.9, fat: 6.9,  carbs: 66.3 },
  { name: 'Овсянка (на воде)',            kcal100: 88,  protein: 3.0,  fat: 1.7,  carbs: 15.0 },
  { name: 'Рис варёный',                  kcal100: 130, protein: 2.7,  fat: 0.3,  carbs: 28.2 },
  { name: 'Гречка варёная',               kcal100: 132, protein: 4.5,  fat: 0.9,  carbs: 25.0 },
  { name: 'Макароны варёные',             kcal100: 158, protein: 5.8,  fat: 0.9,  carbs: 30.0 },

  // Хлеб
  { name: 'Хлеб белый',                   kcal100: 265, protein: 9.0,  fat: 3.2,  carbs: 49.0 },
  { name: 'Хлеб ржаной',                  kcal100: 174, protein: 6.6,  fat: 1.2,  carbs: 33.0 },

  // Мясо и рыба
  { name: 'Куриная грудка варёная',       kcal100: 165, protein: 31.0, fat: 3.6,  carbs: 0    },
  { name: 'Куриное бедро',                kcal100: 209, protein: 26.0, fat: 11.0, carbs: 0    },
  { name: 'Говядина варёная',             kcal100: 250, protein: 26.0, fat: 17.0, carbs: 0    },
  { name: 'Свинина',                      kcal100: 297, protein: 25.7, fat: 21.0, carbs: 0    },
  { name: 'Лосось',                       kcal100: 208, protein: 20.0, fat: 13.0, carbs: 0    },
  { name: 'Тунец консервированный',       kcal100: 116, protein: 25.5, fat: 1.0,  carbs: 0    },

  // Молочные и яйца
  { name: 'Яйцо варёное (1 шт ≈ 50 г)',   kcal100: 155, protein: 13.0, fat: 11.0, carbs: 1.1  },
  { name: 'Творог 5%',                    kcal100: 121, protein: 17.2, fat: 5.0,  carbs: 1.8  },
  { name: 'Творог 0%',                    kcal100: 71,  protein: 16.5, fat: 0.1,  carbs: 1.3  },
  { name: 'Молоко 2.5%',                  kcal100: 52,  protein: 2.8,  fat: 2.5,  carbs: 4.7  },
  { name: 'Сыр твёрдый',                  kcal100: 363, protein: 25.0, fat: 29.0, carbs: 0.3  },
  { name: 'Йогурт натуральный',           kcal100: 59,  protein: 3.5,  fat: 3.3,  carbs: 4.7  },

  // Овощи
  { name: 'Картофель варёный',            kcal100: 87,  protein: 1.9,  fat: 0.1,  carbs: 20.0 },
  { name: 'Огурец',                       kcal100: 15,  protein: 0.7,  fat: 0.1,  carbs: 3.6  },
  { name: 'Помидор',                      kcal100: 18,  protein: 0.9,  fat: 0.2,  carbs: 3.9  },
  { name: 'Морковь',                      kcal100: 41,  protein: 0.9,  fat: 0.2,  carbs: 10.0 },
  { name: 'Брокколи',                     kcal100: 34,  protein: 2.8,  fat: 0.4,  carbs: 7.0  },

  // Орехи и сладкое
  { name: 'Орехи грецкие',                kcal100: 654, protein: 15.0, fat: 65.0, carbs: 14.0 },
  { name: 'Миндаль',                      kcal100: 579, protein: 21.0, fat: 50.0, carbs: 22.0 },
  { name: 'Шоколад молочный',             kcal100: 535, protein: 7.6,  fat: 30.0, carbs: 60.0 }
];

// Стандартные активности: название и ккал в минуту
const ACTIVITIES = [
  { name: 'Бег',              rate: 8  },
  { name: 'Ходьба',           rate: 4  },
  { name: 'Велосипед',        rate: 7  },
  { name: 'Тренажёрный зал',  rate: 6  },
  { name: 'Плавание',         rate: 10 }
];
