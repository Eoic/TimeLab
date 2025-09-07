import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: false, devtools: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:3000');
    await page.waitForSelector('button[aria-label="Load example"]', { timeout: 30000 });
    await page.click('button[aria-label="Load example"]');
    await page.waitForTimeout(5000);
    await page.waitForSelector('button[aria-label="Snap settings"]', { timeout: 10000 });
    await page.click('button[aria-label="Snap settings"]');
    await page.waitForTimeout(1000);

    const dropdown = await page.$('.dropdown-menu');

    const styles = await page.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
            // Inline styles set by JS
            inlinePosition: el.style.position,
            inlineLeft: el.style.left,
            inlineTop: el.style.top,
            inlineInsetInline: el.style.getPropertyValue('inset-inline'),
            inlineInsetBlock: el.style.getPropertyValue('inset-block'),

            // Computed styles from CSS
            computedPosition: computed.position,
            computedLeft: computed.left,
            computedTop: computed.top,
            computedInsetInline: computed.getPropertyValue('inset-inline'),
            computedInsetBlock: computed.getPropertyValue('inset-block'),
            computedRight: computed.right,
            computedBottom: computed.bottom,

            // Classes and other details
            classes: el.className,
            hasPortalClass: el.classList.contains('dropdown-menu--portaled'),
        };
    }, dropdown);

    console.log('🔍 Detailed CSS analysis:');
    console.log('========================');
    console.log('Classes:', styles.classes);
    console.log('Portal class:', styles.hasPortalClass);
    console.log('');
    console.log('INLINE STYLES (set by JS):');
    console.log('  position:', styles.inlinePosition);
    console.log('  left:', styles.inlineLeft);
    console.log('  top:', styles.inlineTop);
    console.log('  inset-inline:', styles.inlineInsetInline);
    console.log('  inset-block:', styles.inlineInsetBlock);
    console.log('');
    console.log('COMPUTED STYLES (final result):');
    console.log('  position:', styles.computedPosition);
    console.log('  left:', styles.computedLeft);
    console.log('  top:', styles.computedTop);
    console.log('  right:', styles.computedRight);
    console.log('  bottom:', styles.computedBottom);
    console.log('  inset-inline:', styles.computedInsetInline);
    console.log('  inset-block:', styles.computedInsetBlock);

    await page.waitForTimeout(10000);
    await browser.close();
})();
