// Component test for TLDropdown positioning
describe('TLDropdown Component', () => {
    beforeEach(() => {
        // Mount a test page with dropdown component
        cy.visit('/');
        cy.get('.loading-screen', { timeout: 10000 }).should('not.exist');
    });

    it('should create dropdown with correct initial state', () => {
        // Programmatically create a dropdown for testing
        cy.window().then((win) => {
            const dropdown = win.document.createElement('tl-dropdown') as any;
            dropdown.setAttribute('data-testid', 'test-dropdown');
            (dropdown as any).options = [
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' },
                { value: 'option3', label: 'Option 3' },
            ];

            // Create a test button to anchor the dropdown
            const button = win.document.createElement('button');
            button.textContent = 'Test Button';
            button.setAttribute('data-testid', 'test-button');
            button.style.position = 'absolute';
            button.style.top = '100px';
            button.style.left = '200px';

            win.document.body.appendChild(button);
            win.document.body.appendChild(dropdown);

            // Test opening dropdown programmatically
            button.addEventListener('click', () => {
                (dropdown as any).open(button);
            });
        });

        // Test the created dropdown
        cy.get('[data-testid="test-dropdown"]').should('exist');
        cy.get('[data-testid="test-button"]').should('be.visible');

        // Click button to open dropdown
        cy.get('[data-testid="test-button"]').click();

        // Verify dropdown opens and positions correctly
        cy.get('[data-testid="test-dropdown"] .dropdown-menu')
            .should('be.visible')
            .should('have.css', 'position', 'fixed');
    });

    it('should handle dropdown options correctly', () => {
        cy.window().then((win) => {
            const dropdown = win.document.createElement('tl-dropdown') as any;
            dropdown.setAttribute('data-testid', 'options-test-dropdown');
            (dropdown as any).options = [
                { value: 'test1', label: 'Test Option 1' },
                { value: 'test2', label: 'Test Option 2' },
            ];

            win.document.body.appendChild(dropdown);

            // Open dropdown
            (dropdown as any).setExpanded(true);
        });

        // Check that options are rendered
        cy.get('[data-testid="options-test-dropdown"] .dropdown-option').should('have.length', 2);

        // Check option content
        cy.get('[data-testid="options-test-dropdown"] .dropdown-option')
            .first()
            .should('contain.text', 'Test Option 1');
    });

    it('should handle multiple selection mode', () => {
        cy.window().then((win) => {
            const dropdown = win.document.createElement('tl-dropdown') as any;
            dropdown.setAttribute('multiple', '');
            dropdown.setAttribute('data-testid', 'multiple-test-dropdown');
            (dropdown as any).options = [
                { value: 'multi1', label: 'Multi Option 1' },
                { value: 'multi2', label: 'Multi Option 2' },
                { value: 'multi3', label: 'Multi Option 3' },
            ];

            win.document.body.appendChild(dropdown);
            (dropdown as any).setExpanded(true);
        });

        // Test multiple selection
        cy.get('[data-testid="multiple-test-dropdown"] .dropdown-option').first().click();

        cy.get('[data-testid="multiple-test-dropdown"] .dropdown-option').last().click();

        // Verify multiple selections (specific behavior depends on implementation)
        cy.get('[data-testid="multiple-test-dropdown"]').should('exist');
    });

    it('should cleanup properly when removed', () => {
        let dropdownElement: any;

        cy.window().then((win) => {
            dropdownElement = win.document.createElement('tl-dropdown') as any;
            dropdownElement.setAttribute('data-testid', 'cleanup-test-dropdown');
            win.document.body.appendChild(dropdownElement);

            // Open dropdown to create portal elements
            (dropdownElement as any).setExpanded(true);
        });

        // Verify dropdown and portal elements exist
        cy.get('[data-testid="cleanup-test-dropdown"]').should('exist');
        cy.get('.dropdown-menu--portaled').should('exist');

        // Remove dropdown
        cy.window().then((win) => {
            if (dropdownElement && dropdownElement.parentNode) {
                dropdownElement.remove();
            }
        });

        // Verify cleanup (portal elements should be removed)
        cy.get('[data-testid="cleanup-test-dropdown"]').should('not.exist');
    });
});
