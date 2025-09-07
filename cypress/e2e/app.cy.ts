describe('TimeLab Application', () => {
    beforeEach(() => {
        cy.visit('/');

        // Wait for the application to load completely
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');

        // Load example data to make chart and toolbar visible
        cy.get(
            'button:contains("Load example"), [aria-label*="Load example"], .btn:contains("Load example")'
        )
            .should('be.visible')
            .click();

        // Wait for chart to load
        cy.get('.chart-container, #chart-container').should('be.visible');
    });

    it('should load the application successfully', () => {
        // Check that main elements are present
        cy.get('.container').should('be.visible');
        cy.get('.tools').should('be.visible');

        // Check that the chart container exists and is visible after loading example
        cy.get('#chart-container, .chart-container').should('be.visible');
    });

    it('should have functional toolbar buttons after loading example', () => {
        // Check that snap settings button exists and is clickable (should be visible after loading example)
        cy.get("[aria-label='Snap settings']").should('be.visible').should('not.be.disabled');

        // Check other common toolbar buttons
        cy.get('.tools button').should('have.length.greaterThan', 0);

        // Each button should be focusable
        cy.get('.tools button').each(($button) => {
            cy.wrap($button).should('not.be.disabled');
        });
    });

    it('should handle file upload area', () => {
        // Check if upload area exists
        cy.get('[data-testid="upload-area"], .upload-area, .file-upload').should('exist');
    });

    it('should display empty states appropriately', () => {
        // Should show empty states when no data is loaded
        cy.get('.empty-state, [data-testid="empty-state"]').should('exist');
    });

    it('should be responsive', () => {
        // Test different viewport sizes
        const viewports = [
            { width: 375, height: 667 }, // Mobile
            { width: 768, height: 1024 }, // Tablet
            { width: 1280, height: 720 }, // Desktop
            { width: 1920, height: 1080 }, // Large desktop
        ];

        viewports.forEach(({ width, height }) => {
            cy.viewport(width, height);

            // Application should still be functional
            cy.get('.container').should('be.visible');
            cy.get('.tools').should('be.visible');

            // UI elements should be within viewport
            cy.get('.tools').should(($tools) => {
                const rect = $tools[0].getBoundingClientRect();
                expect(rect.left).to.be.greaterThan(-10); // Allow small negative margin
                expect(rect.right).to.be.lessThan(width + 10);
            });
        });
    });

    it('should handle theme switching', () => {
        // Look for theme-related controls
        cy.get('[aria-label*="theme"], [class*="theme"], .theme-dropdown')
            .first()
            .should('be.visible');

        // Test theme switching if theme dropdown exists
        cy.get('body').then(($body) => {
            const initialTheme = $body.attr('data-theme') || 'light';

            // Click theme dropdown if it exists
            cy.get('[aria-label*="theme"], [class*="theme"], .theme-dropdown').first().click();

            // Look for theme options
            cy.get('.dropdown-menu .dropdown-option, .theme-option').should(
                'have.length.greaterThan',
                0
            );
        });
    });
});
