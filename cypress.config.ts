import { defineConfig } from 'cypress';

export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:3000',
        supportFile: 'cypress/support/e2e.ts',
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        setupNodeEvents(on, config) {
            // implement node event listeners here
        },
        viewportWidth: 1280,
        viewportHeight: 720,
        video: false,
        screenshotOnRunFailure: true,
    },
    component: {
        devServer: {
            framework: 'vite',
            bundler: 'vite',
        },
        specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/component.ts',
    },
});
