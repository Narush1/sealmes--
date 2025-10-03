import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sanitizeHtml from 'sanitize-html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Файлы для хранения (в корне, без папок)
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const IPS_FILE = path.join(__dirname, 'ips.json');

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let reviews = [];
let ipSet = new Set();

// Загрузка данных из файлов (если есть)
async function loadData() {
  try {
    const [rRaw, ipsRaw] = await Promise.all([
      fs.readFile(REVIEWS_FILE, 'utf8').catch(() => '[]'),
      fs.readFile(IPS_FILE, 'utf8').catch(() => '[]')
    ]);
    reviews = JSON.parse(rRaw || '[]');
    const ipsArr = JSON.parse(ipsRaw || '[]');
    ipSet = new Set(Array.isArray(ipsArr) ? ipsArr : []);
    console.log(`Loaded ${reviews.length} reviews and ${ipSet.size} IPs from disk.`);
  } catch (err) {
    console.error('Ошибка при загрузке данных:', err);
    reviews = [];
    ipSet = new Set();
  }
}

// Сохранение данных в файлы (перезапись)
async function saveData() {
  try {
    // Сохраняем массивы; Set -> Array
    await Promise.all([
      fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8'),
      fs.writeFile(IPS_FILE, JSON.stringify(Array.from(ipSet), null, 2), 'utf8')
    ]);
  } catch (err) {
    console.error('Ошибка при сохранении данных:', err);
  }
}

// Нормализация IP (убираем ::ffff: префикс и ::1 -> 127.0.0.1)
function normalizeIP(ip) {
  if (!ip) return ip;
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

// Настройки sanitize-html (разрешаем только простой текст, некоторые теги можно расширить при необходимости)
const sanitizeOptions = {
  allowedTags: [], // чистый текст
  allowedAttributes: {},
  allowedSchemes: []
};

app.get('/reviews', (req, res) => {
  // Возвращаем отзывы в обратном хронологическом порядке (последние сверху)
  const out = [...reviews].sort((a,b) => b.id - a.id);
  res.json(out);
});

app.post('/reviews', async (req, res) => {
  try {
    const ipRaw = req.ip || req.connection?.remoteAddress || '';
    const ip = normalizeIP(String(ipRaw));

    if (ipSet.has(ip)) {
      return res.status(403).json({ error: 'Вы уже оставили отзыв с этого IP' });
    }

    let { rating, text } = req.body;

    // Валидация
    if (typeof rating === 'string') rating = parseFloat(rating);
    if (typeof rating !== 'number' || Number.isNaN(rating) || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Неверная оценка (должна быть число от 0.0 до 5.0)' });
    }

    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Текст отзыва не может быть пустым' });
    }

    text = text.trim();

    if (text.length > 1000) {
      // увеличил лимит до 1000, можно вернуть 500 если хочешь
      return res.status(400).json({ error: 'Текст отзыва не может быть длиннее 1000 символов' });
    }

    // Очистка текста — более надёжная, чем простая замена символов
    const clean = sanitizeHtml(text, sanitizeOptions);

    const review = {
      id: Date.now(),
      rating: +rating.toFixed(1),
      text: clean,
      ip
    };

    reviews.push(review);
    ipSet.add(ip);

    // Сохраняем данные (асинхронно, не ждём в цикле ответа клиента дольше чем нужно)
    saveData().catch(err => console.error('Ошибка сохранения данных (async):', err));

    return res.status(201).json(review);
  } catch (err) {
    console.error('Ошибка в обработчике /reviews:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// отдаём index.html для прочих путей
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск: сначала загружаем данные, потом стартуем сервер
loadData().then(() => {
  app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
  });
});
