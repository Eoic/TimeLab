describe('Basic Application Test', () => {
    it('should load the application', () => {
        cy.visit('/');

        // Very basic test - just check if the page loads
        cy.get('body').should('exist');
        cy.title().should('not.be.empty');

        // Wait for loading screen to disappear
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');
    });

    it('should find load example button and snap settings button after loading', () => {
        cy.visit('/');
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');

        // First find and click the "Load example" button
        cy.get(
            'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
        )
            .should('be.visible')
            .click();

        // Wait for chart to load
        cy.get('.chart-container, #chart-container').should('be.visible');

        // Now the snap settings button should be visible
        cy.get("button[aria-label='Snap settings'], button:contains('Snap')")
            .should('exist')
            .should('be.visible');
    });

    it('should test dropdown opening after loading example', () => {
        cy.visit('/');
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');

        // Load example data first
        cy.get(
            'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
        )
            .should('be.visible')
            .click();

        // Wait for chart to load
        cy.get('.chart-container, #chart-container').should('be.visible');

        // Try to click the snap settings button
        cy.get("button[aria-label='Snap settings'], button:contains('Snap')").first().click();

        // Look for any dropdown that appears
        cy.get('tl-dropdown, .dropdown-menu, [class*="dropdown"]').should('exist');
    });
});
