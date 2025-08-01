import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const url = process.argv[2] || 'https://www.iaai.com/';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cookiesPath = path.resolve(__dirname, 'www.iaai.com_01-08-2025.json');
if (!url) {
    console.log('No URL passed');
    process.exit(1);
}

// Функция для случайной задержки
const randomDelay = (min = 1000, max = 3000) => {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

// Функция для эмуляции человеческого поведения
const simulateHumanBehavior = async (page) => {
    try {
        // Случайное движение мыши
        await page.mouse.move(
            Math.random() * 1366,
            Math.random() * 768
        );

        // Случайная прокрутка
        await page.evaluate(() => {
            window.scrollBy(0, Math.random() * 500);
        });

        await randomDelay(500, 1500);
    } catch (err) {
        console.log('Warning: Could not simulate human behavior:', err.message);
    }
};

// Функция проверки защиты Incapsula
const checkForIncapsula = (html) => {
    const incapsulaIndicators = [
        'Incapsula',
        'incident_id',
        '_Incapsula_Resource',
        'Request unsuccessful',
        'SWUDNSAI'
    ];

    return incapsulaIndicators.some(indicator => html.includes(indicator));
};

(async () => {
    let browser;
    try {
        // Настройка Stealth плагина
        puppeteer.use(StealthPlugin());

        browser = await puppeteer.launch({
            headless: false, // Оставляем видимым для отладки
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-features=BlockThirdPartyCookies',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            defaultViewport: { width: 1366, height: 768 },
        });

        const page = await browser.newPage();

        // Дополнительные заголовки для имитации реального браузера
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // Скрытие признаков автоматизации
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Переопределяем permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        // Загрузка куков если они существуют
        if (fs.existsSync(cookiesPath) ) {
            try {
                const fileContent = fs.readFileSync(cookiesPath, 'utf8');
                const parsed = JSON.parse(fileContent);

                if (parsed.cookies && Array.isArray(parsed.cookies)) {
                    await page.setCookie(...parsed.cookies);

                } else {
                    console.log('⚠️ Неверный формат файла куков');
                }
            } catch (err) {
                console.error('❌ Ошибка при чтении куков:', err.message);
            }
        } else {
            console.log('⚠️ Файл куков не найден, продолжаем без них');
        }

        // Переходим на страницу с увеличенным таймаутом
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });


        // Первоначальная проверка на защиту
        let html = await page.content();
        let attempts = 0;
        const maxAttempts = 10;

        while (checkForIncapsula(html) && attempts < maxAttempts) {
            attempts++;

            // Эмулируем человеческое поведение
            await simulateHumanBehavior(page);

            // Увеличиваем время ожидания с каждой попыткой
            const waitTime = 5000 + (attempts * 2000);
            await randomDelay(waitTime, waitTime + 2000);

            // Попробуем обновить страницу, если это не первая попытка
            if (attempts > 3) {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await randomDelay(3000, 5000);
            }

            // Пробуем выполнить JavaScript действия, которые могут помочь
            try {
                await page.evaluate(() => {
                    // Имитируем активность пользователя
                    const event = new Event('click', { bubbles: true });
                    document.dispatchEvent(event);

                    // Прокручиваем страницу
                    window.scrollTo(0, document.body.scrollHeight * Math.random());
                });
                await randomDelay(1000, 2000);
            } catch (e) {
                console.log('⚠️ Не удалось выполнить JavaScript действия');
            }

            html = await page.content();
        }

        if (checkForIncapsula(html)) {
            throw new Error('❌ Не удалось обойти защиту Incapsula после всех попыток');
        }


        // Дополнительное ожидание для полной загрузки динамического контента
        await randomDelay(3000, 5000);

        // Ждем загрузки изображений и других ресурсов
        try {
            await page.waitForLoadState?.('networkidle') ||
                await page.waitForFunction(() => document.readyState === 'complete');
        } catch (e) {
            console.log('⚠️ Timeout ожидания полной загрузки, продолжаем...');
        }

        // Получаем финальный HTML
        html = await page.content();

        const $ = cheerio.load(html);

        // Исправляем относительные пути
        $('link[href^="/"], script[src^="/"], img[src^="/"], a[href^="/"]').each((_, el) => {
            const tag = el.tagName;
            const attr = tag === 'link' || tag === 'a' ? 'href' : 'src';
            const oldPath = $(el).attr(attr);
            if (oldPath && !oldPath.startsWith('http')) {
                $(el).attr(attr, `https://www.iaai.com${oldPath}`);
            }
        });

        // Удаляем проблемные скрипты и трекеры
        $(
            'script[src*="bing.com"], ' +
            'script[src*="criteo"], ' +
            'script[src*="sundaysky"], ' +
            'script[src*="kampyle"], ' +
            'script[src*="incapsula"], ' +
            'script[src*="analytics"], ' +
            'script[src*="gtag"], ' +
            'script[src*="facebook"], ' +
            'script[src*="google-analytics"]'
        ).remove();

        // Удаляем iframe защиты если остались
        $('iframe[src*="Incapsula"], iframe[id*="main-iframe"]').remove();

        const cleanedHtml = $.html();

        // Сохраняем куки для будущих сессий
        // try {
        //     const cookies = await page.cookies();
        //     const cookieData = {
        //         timestamp: new Date().toISOString(),
        //         url: url,
        //         cookies: cookies
        //     };
        //     fs.writeFileSync(cookiesPath, JSON.stringify(cookieData, null, 2));
        // } catch (err) {
        //     console.log('⚠️ Не удалось сохранить куки:', err.message);
        // }

        await browser.close();
        // Возвращаем результат как JSON
        console.log(JSON.stringify({
            html: cleanedHtml,
        }));
    } catch (error) {
        console.error('💥 Ошибка скрапинга:', error.message);

        // Возвращаем ошибку в JSON формате
        console.log(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }));

    }
})();