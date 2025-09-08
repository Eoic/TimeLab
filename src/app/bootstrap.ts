/**
 * Application bootstrap and initialization
 * Composition root for the TimeLab application
 */

import { startServices } from '../services/serviceRegistry';

export function initializeApp(): void {
    const app = document.getElementById('app');

    if (!app) {
        throw new Error('Cannot find app container element.');
    }

    // eslint-disable-next-line no-console
    console.info('TimeLab application initialized.');
}

/**
 * Bootstrap the entire application including services
 */
export async function bootstrapApplication(): Promise<void> {
    // Initialize services first
    await startServices();

    // Initialize app UI
    initializeApp();
}
