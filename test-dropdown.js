import puppeteer from 'puppeteer';

async function testDropdownPositioning() {
    console.log('🎯 Testing Snap Settings Dropdown Positioning...\n');

    const browser = await puppeteer.launch({
        headless: false, // So you can see what's happening
        defaultViewport: { width: 1280, height: 720 },
    });

    try {
        const page = await browser.newPage();

        // Navigate to the application
        console.log('📱 Loading TimeLab application...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for loading screen to disappear
        console.log('⏳ Waiting for application to load...');
        await page.waitForSelector('.loading-screen', { hidden: true, timeout: 10000 });

        // Click "Load example" button
        console.log('📊 Looking for "Load example" button...');
        const loadExampleSelectors = [
            'button:contains("Load example")',
            '[aria-label*="Load example"]',
            '.btn:contains("Load example")',
            'button[data-testid="load-example"]',
            'button',
        ];

        let loadButtonFound = false;
        for (const selector of loadExampleSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                console.log(`� Found load button with selector: ${selector}`);
                await page.click(selector);
                loadButtonFound = true;
                break;
            } catch (e) {
                // Try next selector
            }
        }

        if (!loadButtonFound) {
            console.log('⚠️  Could not find Load example button, continuing anyway...');
        }

        // Wait a bit for chart to potentially load
        await page.waitForTimeout(2000);

        // Find snap settings button
        console.log('🔧 Looking for snap settings button...');
        const snapSelectors = [
            "[aria-label='Snap settings']",
            "[aria-label*='Snap']",
            "button:contains('Snap')",
            '.snap-settings',
            '.tools button',
        ];

        let snapButtonFound = false;
        let buttonRect = null;

        for (const selector of snapSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                console.log(`🔧 Found snap button with selector: ${selector}`);

                // Get button position
                buttonRect = await page.evaluate((sel) => {
                    const button = document.querySelector(sel);
                    if (!button) return null;
                    const rect = button.getBoundingClientRect();
                    return {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        right: rect.right,
                        bottom: rect.bottom,
                    };
                }, selector);

                if (buttonRect) {
                    console.log('📍 Button position:', buttonRect);

                    // Click snap settings button
                    console.log('👆 Clicking snap settings button...');
                    await page.click(selector);
                    snapButtonFound = true;
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!snapButtonFound) {
            throw new Error('Could not find snap settings button');
        }

        // Wait for dropdown to appear
        console.log('⏳ Waiting for dropdown to appear...');
        const dropdownSelectors = [
            'tl-dropdown .dropdown-menu',
            '.dropdown-menu',
            '[class*="dropdown"]',
        ];

        let dropdownRect = null;
        for (const selector of dropdownSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                console.log(`📋 Found dropdown with selector: ${selector}`);

                // Get dropdown position
                dropdownRect = await page.evaluate((sel) => {
                    const dropdown = document.querySelector(sel);
                    if (!dropdown) return null;
                    const rect = dropdown.getBoundingClientRect();
                    return {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        right: rect.right,
                        bottom: rect.bottom,
                    };
                }, selector);

                if (dropdownRect) {
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!dropdownRect) {
            throw new Error('Could not find dropdown menu');
        }

        console.log('📍 Dropdown position:', dropdownRect);

        // Calculate screen center
        const screenCenter = { x: 1280 / 2, y: 720 / 2 };
        console.log('📍 Screen center:', screenCenter);

        // Calculate distances
        const dropdownCenter = {
            x: dropdownRect.left + dropdownRect.width / 2,
            y: dropdownRect.top + dropdownRect.height / 2,
        };

        const distanceFromScreenCenter = Math.sqrt(
            Math.pow(dropdownCenter.x - screenCenter.x, 2) +
                Math.pow(dropdownCenter.y - screenCenter.y, 2)
        );

        const distanceFromButton = Math.min(
            Math.abs(dropdownRect.left - buttonRect.left),
            Math.abs(dropdownRect.left - buttonRect.right),
            Math.abs(dropdownRect.right - buttonRect.left),
            Math.abs(dropdownRect.right - buttonRect.right)
        );

        console.log('\n🎯 POSITIONING ANALYSIS:');
        console.log('='.repeat(50));
        console.log(`📏 Distance from screen center: ${distanceFromScreenCenter.toFixed(1)}px`);
        console.log(`📏 Distance from button: ${distanceFromButton.toFixed(1)}px`);

        // Determine if positioning is correct
        const isInCenter = distanceFromScreenCenter < 100; // Within 100px of center
        const isNearButton = distanceFromButton < 100; // Within 100px of button

        console.log('\n🔍 RESULTS:');
        console.log('='.repeat(50));
        if (isInCenter) {
            console.log('❌ PROBLEM: Dropdown is opening in the center of the screen!');
            console.log(
                `   Center distance: ${distanceFromScreenCenter.toFixed(1)}px (should be > 100px)`
            );
        } else {
            console.log('✅ GOOD: Dropdown is not in the center of the screen');
        }

        if (isNearButton) {
            console.log('✅ GOOD: Dropdown is positioned near the button');
        } else {
            console.log('❌ PROBLEM: Dropdown is too far from the button!');
            console.log(
                `   Button distance: ${distanceFromButton.toFixed(1)}px (should be < 100px)`
            );
        }

        // Overall assessment
        console.log('\n🎯 OVERALL ASSESSMENT:');
        console.log('='.repeat(50));
        if (!isInCenter && isNearButton) {
            console.log('✅ POSITIONING IS CORRECT!');
        } else {
            console.log('❌ POSITIONING NEEDS FIXING!');
            if (isInCenter) {
                console.log('   → Dropdown opens in screen center (main bug)');
            }
            if (!isNearButton) {
                console.log('   → Dropdown is too far from trigger button');
            }
        }

        // Wait a bit so you can see the result
        console.log('\n⏳ Waiting 5 seconds for visual inspection...');
        await page.waitForTimeout(5000);
    } catch (error) {
        console.error('❌ Error during test:', error.message);
    } finally {
        await browser.close();
    }
}

// Run the test
testDropdownPositioning().catch(console.error);
