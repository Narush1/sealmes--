const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Пути к файлам с отзывами и IP
const reviewsFile = path.join(__dirname, 'reviews.json');
const ipsFile = path.join(__dirname, 'ips.json');

// Загружаем отзывы из файла или пустой массив
let reviews = [];
try {
  reviews = JSON.parse(fs.readFileSync(reviewsFile, 'utf-8'));
  if (!Array.isArray(reviews)) reviews = [];
} catch {
  reviews = [];
}

// Загружаем список IP, которые уже оставили отзывы
let ips = [];
try {
  ips = JSON.parse(fs.readFileSync(ipsFile, 'utf-8'));
  if (!Array.isArray(ips)) ips = [];
} catch {
  ips = [];
}

// Функция для сохранения отзывов и IP
function saveData() {
  fs.writeFileSync(reviewsFile, JSON.stringify(reviews, null, 2));
  fs.writeFileSync(ipsFile, JSON.stringify(ips, null, 2));
}

// Получить IP клиента (надежно, учитывая прокси)
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection.remoteAddress ||
    ''
  );
}

// Отдаём статику и index.html
app.use(express.static(__dirname));

// Получить все отзывы
app.get('/reviews', (req, res) => {
  res.json(reviews);
});

// Получить среднюю оценку
app.get('/average-rating', (req, res) => {
  if (reviews.length === 0) return res.json({ average: 0 });
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = sum / reviews.length;
  res.json({ average });
});

// Добавить отзыв
app.post('/reviews', (req, res) => {
  const { rating, text } = req.body;
  const ip = getClientIp(req);

  if (typeof rating !== 'number' || rating < 0 || rating > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 0 до 5' });
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Текст отзыва обязателен' });
  }
  if (ips.includes(ip)) {
    return res.status(403).json({ error: 'Вы уже оставили отзыв с этого IP' });
  }

  const newReview = { rating, text: text.trim() };
  reviews.push(newReview);
  ips.push(ip);

  try {
    saveData();
  } catch (err) {
    console.error('Ошибка сохранения:', err);
    return res.status(500).json({ error: 'Ошибка сервера при сохранении' });
  }

  res.json({ message: 'Отзыв добавлен' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
