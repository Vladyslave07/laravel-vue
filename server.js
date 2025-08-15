import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

chromium.use(stealth());

const PORT = process.env.PORT || 8080;
const BASE_URL = 'https://www.copart.com/';

const app = express();
app.use(cors({ origin: true, credentials: false })); // Разрешаем CORS для фронтов на другом домене/порту
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let browser;
let page;
 
// Инициализация Playwright (один раз)
(async () => {
  const userDataDir = path.resolve(os.tmpdir(), 'copart-scraper-user-data');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
  });

  page = browser.pages().length ? browser.pages()[0] : await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  console.log('🚀 Playwright запущен');
})();

const sendHtml = async (ws) => {
  const raw = await page.content();
  const $ = cheerio.load(raw);

  // Абсолютные пути для статики
  $('link[href^="/"], script[src^="/"], img[src^="/"]').each((_, el) => {
    const tag = el.tagName;
    const attr = tag === 'link' ? 'href' : 'src';
    const oldPath = $(el).attr(attr);
    if (oldPath && !oldPath.startsWith('http')) {
      $(el).attr(attr, `${BASE_URL}${oldPath}`);
    }
  });

  // Удаляем <base>
  $('base').remove();

  // Ссылки -> data-href
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const absolute = href.startsWith('http') ? href : new URL(href, BASE_URL).href;
      $(el).removeAttr('href').attr('data-href', absolute);
    }
  });

  // Формы -> data-action
  $('form[action]').each((_, el) => {
    const action = $(el).attr('action');
    if (action) {
      const absolute = action.startsWith('http') ? action : `${BASE_URL}${action}`;
      $(el).removeAttr('action').attr('data-action', absolute);
    }
  });

  ws.send(JSON.stringify({
    type: 'html',
    html: $.html(),
    url: page.url(),
  }));
};

let isNavigating = false;

// keep-alive для WS
function heartbeat() { this.isAlive = true; }
wss.on('connection', async (ws, req) => {
  console.log('🔌 WebSocket клиент подключен:', req.socket.remoteAddress);
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sendHtml(ws);
  } catch (e) {
    console.error('❌ Ошибка initial goto:', e.message);
    ws.send(JSON.stringify({ type: 'error', message: e.message }));
  }

  ws.on('message', async (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    try {
      if (data.type === 'click') {
        console.log('🖱 Click selector:', data.selector);
        await page.click(data.selector, { timeout: 5000 }).catch(() => {});
      } else if (data.type === 'navigate') {
        const targetUrl = new URL(data.url, BASE_URL).toString();
        if (page.url() !== targetUrl && !isNavigating) {
          isNavigating = true;
          console.log('🌐 Navigate to:', targetUrl);
          await page.goto(targetUrl, { waitUntil: 'networkidle' });
          isNavigating = false;
        } else {
          console.log('⏩ Пропускаем повторный переход:', targetUrl);
        }
      } else if (data.type === 'scroll') {
        await page.evaluate((y) => window.scrollTo(0, y), data.y);
      }
      await sendHtml(ws);
    } catch (err) {
      console.error('❌ Ошибка Playwright:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
      isNavigating = false;
    }
  });

  ws.on('close', () => console.log('🔌 WS клиент отключен'));
});

// Пинг клиентов раз в 30 сек
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => clearInterval(interval));

// Отдаём URL для подключения WS (динамически подставляем ws:// / wss:// и хост)
app.get('/proxy-copart', (req, res) => {
  const proto = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).toString();
  const isHttps = proto === 'https';
  const wsProto = isHttps ? 'wss' : 'ws';

  // Если сервер висит за прокси — host придёт уже правильный (с портом).
  const host = req.headers.host || `localhost:${PORT}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ ws_url: `${wsProto}://${host}` });
});

server.listen(PORT, () => {
  console.log(`🌐 HTTP: http://localhost:${PORT}`);
});
