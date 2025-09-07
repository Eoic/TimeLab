describe('Dropdown Positioning', () => {
    beforeEach(() => {
        // Visit the application
        cy.visit('/');

        // Wait for the application to load
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');

        // Click "Load example" button to make chart and toolbar visible
        cy.get(
            'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
        )
            .should('be.visible')
            .click();

        // Wait for chart and toolbar to load
        cy.get('.chart-container, #chart-container').should('be.visible');
        cy.get('.tools').should('be.visible');
    });

    describe('Snap Settings Dropdown', () => {
        it('should position the dropdown correctly relative to the snap settings button', () => {
            // Find the snap settings button (should now be visible after loading example)
            cy.get("[aria-label='Snap settings']").should('be.visible');

            // Get the button position for comparison
            cy.getButtonPosition("[aria-label='Snap settings']").then((buttonPos) => {
                // Click the snap settings button to open dropdown
                cy.get("[aria-label='Snap settings']").click();

                // Wait for dropdown to appear and be positioned
                cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 })
                    .should('be.visible')
                    .should('have.css', 'position', 'fixed');

                // Get dropdown position
                cy.get('tl-dropdown .dropdown-menu').then(($dropdown) => {
                    const dropdownRect = $dropdown[0].getBoundingClientRect();

                    // Verify dropdown is positioned relative to button, not in center of screen
                    const screenCenterX = Cypress.config('viewportWidth') / 2;
                    const screenCenterY = Cypress.config('viewportHeight') / 2;

                    // Dropdown should NOT be in the center of the screen
                    expect(Math.abs(dropdownRect.left - screenCenterX)).to.be.greaterThan(50);
                    expect(Math.abs(dropdownRect.top - screenCenterY)).to.be.greaterThan(50);

                    // Dropdown should be positioned near the button
                    // Allow some tolerance for spacing/gaps
                    const dropdownRight = dropdownRect.left + dropdownRect.width;
                    const dropdownBottom = dropdownRect.top + dropdownRect.height;
                    const buttonRight = buttonPos.left + buttonPos.width;
                    const buttonBottom = buttonPos.top + buttonPos.height;

                    const horizontalDistance = Math.min(
                        Math.abs(dropdownRect.left - buttonPos.left),
                        Math.abs(dropdownRight - buttonRight),
                        Math.abs(dropdownRect.left - buttonRight),
                        Math.abs(dropdownRight - buttonPos.left)
                    );

                    const verticalDistance = Math.min(
                        Math.abs(dropdownRect.top - buttonBottom),
                        Math.abs(dropdownBottom - buttonPos.top)
                    );

                    // Dropdown should be close to the button (within reasonable distance)
                    expect(horizontalDistance).to.be.lessThan(200);
                    expect(verticalDistance).to.be.lessThan(50);

                    // Log positions for debugging
                    cy.log('Button position:', JSON.stringify(buttonPos));
                    cy.log(
                        'Dropdown position:',
                        JSON.stringify({
                            top: dropdownRect.top,
                            left: dropdownRect.left,
                            width: dropdownRect.width,
                            height: dropdownRect.height,
                        })
                    );
                });
            });
        });

        it('should position dropdown correctly on different screen sizes', () => {
            // Test on mobile size
            cy.viewport(375, 667);

            // Reload the example after viewport change
            cy.get(
                'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
            )
                .should('be.visible')
                .click();

            cy.get("[aria-label='Snap settings']").should('be.visible');

            cy.getButtonPosition("[aria-label='Snap settings']").then((buttonPos) => {
                cy.get("[aria-label='Snap settings']").click();

                cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 })
                    .should('be.visible')
                    .then(($dropdown) => {
                        const dropdownRect = $dropdown[0].getBoundingClientRect();

                        // On small screens, dropdown should still be near button, not centered
                        const screenCenterX = 375 / 2;
                        expect(Math.abs(dropdownRect.left - screenCenterX)).to.be.greaterThan(30);

                        // Should be within viewport bounds
                        expect(dropdownRect.left).to.be.greaterThan(0);
                        expect(dropdownRect.left + dropdownRect.width).to.be.lessThan(375);
                    });
            });

            // Test on tablet size
            cy.viewport(768, 1024);

            // Reload example for tablet viewport
            cy.get(
                'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
            )
                .should('be.visible')
                .click();

            cy.get("[aria-label='Snap settings']").should('be.visible');
            cy.get("[aria-label='Snap settings']").click();
            cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 }).should('be.visible');

            // Test on desktop size
            cy.viewport(1920, 1080);

            // Reload example for desktop viewport
            cy.get(
                'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
            )
                .should('be.visible')
                .click();

            cy.get("[aria-label='Snap settings']").should('be.visible');
            cy.get("[aria-label='Snap settings']").click();
            cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 }).should('be.visible');
        });

        it('should close dropdown when clicking outside', () => {
            // Open dropdown
            cy.get("[aria-label='Snap settings']").click();
            cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 }).should('be.visible');

            // Click outside dropdown
            cy.get('body').click(0, 0);

            // Dropdown should close
            cy.get('tl-dropdown .dropdown-menu').should('not.be.visible');
        });

        it('should handle keyboard navigation', () => {
            // Open dropdown with keyboard
            cy.get("[aria-label='Snap settings']").focus().type('{enter}');
            cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 }).should('be.visible');

            // Close with escape
            cy.get('body').type('{esc}');
            cy.get('tl-dropdown .dropdown-menu').should('not.be.visible');
        });
    });

    describe('Other Dropdowns', () => {
        it('should position theme dropdown correctly', () => {
            // Find theme dropdown button (usually in settings/toolbar area)
            cy.get('[aria-label*="theme"], [class*="theme"], .theme-dropdown')
                .first()
                .should('be.visible');

            cy.get('[aria-label*="theme"], [class*="theme"], .theme-dropdown')
                .first()
                .then(($button) => {
                    const buttonRect = $button[0].getBoundingClientRect();

                    $button.click();

                    // Wait for dropdown to appear
                    cy.get('tl-dropdown .dropdown-menu', { timeout: 5000 })
                        .should('be.visible')
                        .then(($dropdown) => {
                            const dropdownRect = $dropdown[0].getBoundingClientRect();

                            // Verify positioning relative to theme button
                            const horizontalDistance = Math.min(
                                Math.abs(dropdownRect.left - buttonRect.left),
                                Math.abs(dropdownRect.right - buttonRect.right)
                            );

                            expect(horizontalDistance).to.be.lessThan(100);
                        });
                });
        });
    });
});
