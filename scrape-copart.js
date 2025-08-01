import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
const url = process.argv[2] || 'https://www.copart.com/';

if (!url) {
    console.error('No URL passed');
    process.exit(1);
}

(async () => {
    try {
        console.log(`Starting scraping for URL: ${url}`);

        puppeteer.use(StealthPlugin());

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const title = await page.title();
        const html = await page.content();
        const $ = cheerio.load(html);
        $('link[href^="/"], script[src^="/"], img[src^="/"], a[href^="/"]').each((_, el) => {
            const tag = el.tagName;
            const attr = tag === 'link' || tag === 'a' ? 'href' : 'src';
            const oldPath = $(el).attr(attr);
            $(el).attr(attr, `https://www.copart.com${oldPath}`);
        });

        // Удаляем скрипты аналитики или рекламы (по желанию)
        $('script[src*="bing.com"], script[src*="criteo"], script[src*="sundaysky"], script[src*="kampyle"]').remove();

        const cleanedHtml = $.html();

        await browser.close();

        // Возвращаем результат как JSON
        console.log(JSON.stringify({
            html: cleanedHtml,
        }));
    } catch (error) {
        console.error('Scraping error:', error.message);
        process.exit(1);
    }
})();