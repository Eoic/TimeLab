import puppeteer from 'puppeteer';

async function testDropdownPositioning() {
    console.log('🎯 Testing Snap Settings Dropdown Positioning...\n');

    const browser = await puppeteer.launch({
        headless: false, // So you can see what's happening
        defaultViewport: { width: 1280, height: 720 },
    });

    try {
        const page = await browser.newPage();

        // Listen for console logs from the page
        page.on('console', (msg) => {
            if (msg.text().includes('repositionMenu')) {
                console.log('🔍 Browser Console:', msg.text());
                // Try to get the actual args if they're objects
                const args = msg.args();
                args.forEach(async (arg, i) => {
                    try {
                        const value = await arg.jsonValue();
                        console.log(`   Arg ${i}:`, JSON.stringify(value, null, 2));
                    } catch (e) {
                        // Ignore if can't convert to JSON
                    }
                });
            }
        });

        // Navigate to the application
        console.log('📱 Loading TimeLab application...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for loading screen to disappear
        console.log('⏳ Waiting for application to load...');
        await page.waitForSelector('.loading-screen', { hidden: true, timeout: 10000 });

        // Click "Load example" button
        console.log('📊 Looking for "Load example" button...');
        const loadExampleSelectors = [
            'button[aria-label*="Load example"]',
            'button[data-testid="load-example"]',
            '.project-toolbar button',
            'button',
        ];

        let loadButtonFound = false;
        for (const selector of loadExampleSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                const buttons = await page.$$(selector);

                for (const button of buttons) {
                    const text = await page.evaluate(
                        (el) => el.textContent || el.getAttribute('aria-label') || '',
                        button
                    );
                    if (
                        text.toLowerCase().includes('load') ||
                        text.toLowerCase().includes('example')
                    ) {
                        console.log(`📊 Found load button: "${text}"`);
                        await button.click();
                        loadButtonFound = true;
                        break;
                    }
                }

                if (loadButtonFound) break;
            } catch (err) {
                // Try next selector
            }
        }

        if (!loadButtonFound) {
            console.log('⚠️  Could not find Load example button, continuing anyway...');
        }

        // Wait a bit for chart to potentially load
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Find snap settings button - using the exact structure provided
        console.log('🔧 Looking for snap settings button...');

        // Wait for chart toolbar to appear after loading example
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const snapSelectors = [
            "button.btn-icon[aria-label='Snap settings']", // Exact selector
            "button[aria-label='Snap settings']",
            ".btn-icon[aria-label*='Snap']",
            ".tools button[aria-label*='snap']",
        ];

        let snapButtonFound = false;
        let buttonRect = null;

        // Try the exact selector first
        try {
            console.log('🎯 Looking for: button.btn-icon[aria-label="Snap settings"]');
            await page.waitForSelector("button.btn-icon[aria-label='Snap settings']", {
                visible: true,
                timeout: 5000,
            });

            const snapButton = await page.$("button.btn-icon[aria-label='Snap settings']");
            if (snapButton) {
                console.log('✅ Found snap settings button with exact selector!');

                // Verify it has the material icon
                const buttonInfo = await page.evaluate((el) => {
                    const icon = el.querySelector('.material-symbols-outlined');
                    return {
                        hasIcon: !!icon,
                        iconText: icon ? icon.textContent : '',
                        classes: el.className,
                        label: el.getAttribute('aria-label'),
                        title: el.getAttribute('title'),
                    };
                }, snapButton);

                console.log('� Button details:', buttonInfo);

                // Get button position
                buttonRect = await page.evaluate((el) => {
                    const rect = el.getBoundingClientRect();
                    return {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        right: rect.right,
                        bottom: rect.bottom,
                    };
                }, snapButton);

                console.log('📍 Button position:', buttonRect);

                // Click snap settings button
                console.log('👆 Clicking snap settings button...');
                await snapButton.click();
                snapButtonFound = true;
            }
        } catch (err) {
            console.log('⚠️ Could not find button with exact selector, trying alternatives...');
        }

        // Fallback to other selectors if exact one fails
        if (!snapButtonFound) {
            for (const selector of snapSelectors.slice(1)) {
                try {
                    await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                    const buttons = await page.$$(selector);

                    for (const button of buttons) {
                        const text = await page.evaluate((el) => {
                            const label = el.getAttribute('aria-label') || '';
                            const title = el.getAttribute('title') || '';
                            return { label, title };
                        }, button);

                        if (
                            text.label.toLowerCase().includes('snap') ||
                            text.title.toLowerCase().includes('snap')
                        ) {
                            console.log(`🔧 Found snap button: "${text.label || text.title}"`);

                            // Get button position
                            buttonRect = await page.evaluate((el) => {
                                const rect = el.getBoundingClientRect();
                                return {
                                    left: rect.left,
                                    top: rect.top,
                                    width: rect.width,
                                    height: rect.height,
                                    right: rect.right,
                                    bottom: rect.bottom,
                                };
                            }, button);

                            if (buttonRect) {
                                console.log('📍 Button position:', buttonRect);

                                // Click snap settings button
                                console.log('👆 Clicking snap settings button...');
                                await button.click();
                                snapButtonFound = true;
                                break;
                            }
                        }
                    }

                    if (snapButtonFound) break;
                } catch (err) {
                    // Try next selector
                }
            }
        }

        if (!snapButtonFound) {
            // Let's see what buttons are available
            console.log('🔍 Available buttons:');
            const allButtons = await page.$$('button');
            for (const button of allButtons.slice(0, 10)) {
                // Limit to first 10
                const text = await page.evaluate((el) => {
                    const label = el.getAttribute('aria-label') || '';
                    const content = el.textContent || '';
                    const title = el.getAttribute('title') || '';
                    return { label, content: content.trim(), title };
                }, button);
                console.log('   Button:', text);
            }
            throw new Error('Could not find snap settings button');
        }

        // Wait for dropdown to appear
        console.log('⏳ Waiting for dropdown to appear...');
        const dropdownSelectors = [
            '.dropdown-menu',
            '.dropdown-menu--portaled',
            'tl-dropdown .dropdown-menu',
            '[class*="dropdown"]',
        ];

        let dropdownRect = null;
        for (const selector of dropdownSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                console.log(`📋 Found dropdown with selector: ${selector}`);
                console.log('📋 Dropdown details:', dropdownRect);

                // Get dropdown position with detailed info
                dropdownRect = await page.evaluate((sel) => {
                    const dropdown = document.querySelector(sel);
                    if (!dropdown) return null;
                    const rect = dropdown.getBoundingClientRect();
                    return {
                        selector: sel,
                        tagName: dropdown.tagName,
                        className: dropdown.className,
                        id: dropdown.id || 'no-id',
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
            } catch (err) {
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
        await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
        console.error('❌ Error during test:', error.message);
    } finally {
        await browser.close();
    }
}

// Run the test
testDropdownPositioning().catch(console.error);
