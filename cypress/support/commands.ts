// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
    namespace Cypress {
        interface Chainable {
            /**
             * Custom command to load test data
             * @example cy.loadTestData()
             */
            loadTestData(): Chainable<void>;

            /**
             * Custom command to get dropdown position
             * @example cy.getDropdownPosition('snap-settings')
             */
            getDropdownPosition(dropdownId: string): Chainable<{
                top: number;
                left: number;
                width: number;
                height: number;
            }>;

            /**
             * Custom command to get button position for comparison
             * @example cy.getButtonPosition('[aria-label="Snap settings"]')
             */
            getButtonPosition(selector: string): Chainable<{
                top: number;
                left: number;
                width: number;
                height: number;
            }>;
        }
    }
}

Cypress.Commands.add('loadTestData', () => {
    // Load some test CSV data for testing
    cy.fixture('test-data.csv').then((csvData) => {
        cy.window().then((win) => {
            // Simulate file upload by creating a blob and triggering the upload
            const blob = new Blob([csvData], { type: 'text/csv' });
            const file = new File([blob], 'test-data.csv', { type: 'text/csv' });

            // You can dispatch a custom event or call the upload handler directly
            win.dispatchEvent(new CustomEvent('timelab:loadTestData', { detail: { file } }));
        });
    });
});

Cypress.Commands.add('getDropdownPosition', (dropdownId: string) => {
    cy.get(`tl-dropdown[data-testid="${dropdownId}"], tl-dropdown`).then(($dropdown) => {
        const menu = $dropdown.find('.dropdown-menu')[0];
        if (!menu) {
            throw new Error(`Dropdown menu not found for ${dropdownId}`);
        }

        const rect = menu.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        };
    });
});

Cypress.Commands.add('getButtonPosition', (selector: string) => {
    cy.get(selector).then(($button) => {
        const rect = $button[0].getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        };
    });
});

export {};
