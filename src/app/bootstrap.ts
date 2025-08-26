/**
 * Application bootstrap and initialization
 * Composition root for the TimeLab application
 */

export function initializeApp(): void {
    const app = document.getElementById('app');

    if (!app) {
        throw new Error('Cannot find app container element.');
    }

    // eslint-disable-next-line no-console
    console.info('TimeLab application initialized.');
}
