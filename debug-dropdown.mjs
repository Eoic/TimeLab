import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: false, devtools: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:3000');
    await page.waitForSelector('button[aria-label="Load example"]', { timeout: 30000 });
    await page.click('button[aria-label="Load example"]');
    await page.waitForSelector('button[aria-label="Snap settings"]', { timeout: 10000 });
    await page.click('button[aria-label="Snap settings"]');
    await page.waitForTimeout(1000);

    const dropdown = await page.$('.dropdown-menu');
    const classes = await page.evaluate((el) => el.className, dropdown);
    const styles = await page.evaluate(
        (el) => ({
            position: el.style.position,
            left: el.style.left,
            top: el.style.top,
            computedPosition: getComputedStyle(el).position,
            computedLeft: getComputedStyle(el).left,
            computedTop: getComputedStyle(el).top,
            hasPortalClass: el.classList.contains('dropdown-menu--portaled'),
        }),
        dropdown
    );

    console.log('🔍 Dropdown classes:', classes);
    console.log('🔍 Dropdown styles:', styles);

    await page.waitForTimeout(5000);
    await browser.close();
})();
