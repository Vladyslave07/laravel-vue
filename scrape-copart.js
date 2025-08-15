import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const url = process.argv[2] || 'https://www.copart.com/';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const maxAttempts = 10;
const logPath = path.resolve(__dirname, 'storage/logs/scraper.log');
const log = (msg) => {
  const timestamp = new Date().toISOString();
  const fullMsg = `[${timestamp}] ${msg}`;
  console.log(fullMsg);
  fs.appendFileSync(logPath, fullMsg + '\n');
};
// Функция для случайной задержки
const randomDelay = (min = 1000, max = 3000) =>
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// Функция для проверки наличия защиты Incapsula
const checkForIncapsula = (html) => {
  const indicators = [
    'Incapsula',
    'incident_id',
    '_Incapsula_Resource',
    'Request unsuccessful',
    'SWUDNSAI'
  ];
  return indicators.some(indicator => html.includes(indicator));
};

const simulateHumanBehavior = async (page) => {
  try {
    await page.mouse.move(Math.random() * 1366, Math.random() * 768);
    await page.keyboard.press('PageDown');
    await randomDelay(500, 1500);
  } catch (err) {
    console.warn('⚠️ Не удалось эмулировать поведение человека:', err.message);
  }
};

(async () => {
  let browserContext;

  try {
    log('🚀 Запуск браузера с persistent-контекстом...');
    browserContext = await chromium.launch({
      headless: false,
      viewport: { width: 1366, height: 768 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const page = await browserContext.newPage();

    // Устанавливаем заголовки
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    let html;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await randomDelay(2000, 4000);
      await simulateHumanBehavior(page);

      html = await page.content();
      if (!checkForIncapsula(html)) break;

      attempts++;
      console.log(`🔄 Попытка обхода защиты #${attempts}`);
      await randomDelay(2000 + attempts * 1000, 4000 + attempts * 1500);
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    if (checkForIncapsula(html)) {
      throw new Error('❌ Защита Incapsula не была обойдена после всех попыток');
    }

    // Подгружаем оставшийся контент
    await page.waitForLoadState('networkidle');
    html = await page.content();
    const $ = cheerio.load(html);

    // Преобразуем относительные пути
    $('link[href^="/"], script[src^="/"], img[src^="/"], a[href^="/"]').each((_, el) => {
      const tag = el.tagName;
      const attr = tag === 'link' || tag === 'a' ? 'href' : 'src';
      const oldPath = $(el).attr(attr);
      if (oldPath && !oldPath.startsWith('http')) {
        $(el).attr(attr, `https://www.copart.com${oldPath}`);
      }
    });

    // Удаляем трекеры и лишние скрипты
    $('script[src*="analytics"], script[src*="gtag"], script[src*="facebook"], script[src*="incapsula"]').remove();
    $('iframe[src*="incapsula"], iframe[id*="main-iframe"]').remove();

    const cleanedHtml = $.html();

    // Закрытие браузера
    await browserContext.close();

    // Вывод результата
    console.log(JSON.stringify({
      html: cleanedHtml
    }));
    

  } catch (err) {
    console.error('💥 Ошибка:', err.message);
    console.log(JSON.stringify({
      success: false,
      error: err.message
    }));
  } 
})();
