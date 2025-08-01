import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
const url = process.argv[2] || 'https://www.iaai.com/';
const EMAIL = 'blank.mobile217@gmail.com';
const PASSWORD = 'Vlad07112002';
const LOGIN_URL = 'https://www.iaai.com/Dashboard/Default';

if (!url) {
    console.error('No URL passed');
    process.exit(1);
}

(async () => {
    try {
        puppeteer.use(StealthPlugin());

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: null,
        });

        const page = await browser.newPage();
 
        // // 1. Перейти на страницу логина
        // await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        

        // // 2. Ввести email и пароль
        // await page.waitForSelector('#Email', { timeout: 30000 });
        // await page.type('#Email', EMAIL, { delay: 100 });
        // await page.type('#Password', PASSWORD, { delay: 100 });

        // // 3. Нажать кнопку входа
        // await Promise.all([
        //     page.click('button[type="submit"]'),
        //     page.waitForNavigation({ waitUntil: 'networkidle2' }),
        // ]);

        // await page.waitForNavigation({
        //     waitUntil: 'networkidle2',
        //     timeout: 30000,
        // });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const html = await page.content();
        const $ = cheerio.load(html);
        $('link[href^="/"], script[src^="/"], img[src^="/"], a[href^="/"]').each((_, el) => {
            const tag = el.tagName;
            const attr = tag === 'link' || tag === 'a' ? 'href' : 'src';
            const oldPath = $(el).attr(attr);
            $(el).attr(attr, `https://www.iaai.com${oldPath}`);
        });

        // Удаляем скрипты аналитики или рекламы (по желанию)
        $('script[src*="bing.com"], script[src*="criteo"], script[src*="sundaysky"], script[src*="kampyle"]').remove();

        const cleanedHtml = $.html();

        await browser.close();

        // Возвращаем результат как JSON
        console.log("Перемога!");
    } catch (error) {
        console.error('Scraping error:', error.message);
        process.exit(1);
    }
})();