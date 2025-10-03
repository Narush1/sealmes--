const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const reviews = [];

app.get('/reviews', (req, res) => {
  res.json(reviews);
});

app.post('/reviews', (req, res) => {
  const { name, text, rating } = req.body;

  if (!name || !text || !rating) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const ratingNum = Number(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }

  reviews.push({ name, text, rating: ratingNum });
  res.json({ message: 'Отзыв добавлен' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
