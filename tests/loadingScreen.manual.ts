/**
 * Simple test script to verify loading screen reaches 100%
 * This can be run manually in the browser console
 */

// Test that loading screen progress reaches exactly 100%
export function testLoadingScreenProgress(): Promise<boolean> {
    return new Promise((resolve) => {
        // Create a fresh loading screen element for testing
        const testElement = document.createElement('div');
        testElement.innerHTML = `
            <div class="loading-percentage">0%</div>
            <div class="loading-status">Initializing...</div>
        `;
        document.body.appendChild(testElement);

        // Import and test the loading screen
        import('../src/ui/loadingScreen').then(({ markLoadingStepComplete }) => {
            const progressElement = testElement.querySelector('.loading-percentage');

            if (!progressElement) {
                resolve(false);
                return;
            }

            // Complete all required steps
            const steps = [
                'app-initialized',
                'project-toolbar-initialized',
                'ui-setup',
                'chart-initialized',
                'dropdowns-setup',
                'data-loaded',
                'themes-ready',
                'label-definitions-loaded',
            ];

            // Mark all steps as complete
            steps.forEach((step) => {
                markLoadingStepComplete(step);
            });

            // Check if progress reached 100%
            setTimeout(() => {
                const finalProgress = progressElement.textContent;
                document.body.removeChild(testElement);
                resolve(finalProgress === '100%');
            }, 200);
        });
    });
}

// Make it available globally for manual testing
if (typeof window !== 'undefined') {
    (window as any).testLoadingScreenProgress = testLoadingScreenProgress;
}
