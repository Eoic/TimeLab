/**
 * Loading screen functionality
 * Manages the initial loading state and smooth transition out
 */

interface LoadingState {
    isComplete: boolean;
    completedSteps: Set<string>;
    requiredSteps: string[];
}

class LoadingManager {
    private state: LoadingState = {
        isComplete: false,
        completedSteps: new Set(),
        requiredSteps: [
            'app-initialized',
            'project-toolbar-initialized',
            'ui-setup',
            'chart-initialized',
            'dropdowns-setup',
            'data-loaded',
            'themes-ready',
            'label-definitions-loaded',
        ],
    };

    private loadingElement: HTMLElement | null = null;
    private startTime = Date.now();
    private minDisplayTime = 500; // Minimum display time

    constructor() {
        this.loadingElement = document.getElementById('loading-screen');

        // Ensure initial progress display
        this.updateProgress();

        // Auto-complete after a maximum timeout to prevent infinite loading
        setTimeout(() => {
            if (!this.state.isComplete) {
                // Loading timeout reached, forcing completion for safety
                this.completeLoading();
            }
        }, 10000); // 10 second timeout

        // Ensure spinner is visible and animating
        this.ensureSpinnerAnimation();
    }

    /**
     * Mark a loading step as complete
     */
    markStepComplete(step: string): void {
        this.state.completedSteps.add(step);
        this.updateProgress();

        // Check if we should complete loading
        if (this.areAllStepsComplete()) {
            // Ensure progress shows 100% before completing
            setTimeout(() => {
                // Double-check progress is at 100%
                this.ensureProgressAt100();
                this.completeLoading();
            }, 100); // Small delay to ensure UI updates are visible
        }
    }

    /**
     * Ensure progress shows exactly 100% when all steps are complete
     */
    private ensureProgressAt100(): void {
        const percentageText = document.querySelector('.loading-percentage');
        if (percentageText && this.areAllStepsComplete()) {
            percentageText.textContent = '100%';

            // Force browser reflow to ensure update is visible
            if (percentageText instanceof HTMLElement) {
                void percentageText.offsetHeight;
            }
        }
    }

    /**
     * Ensure spinner animation is working properly
     */
    private ensureSpinnerAnimation(): void {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            const spinner = document.querySelector('.loading-spinner');
            if (spinner instanceof HTMLElement) {
                // Force animation by resetting and re-applying
                const animationName = 'spin 1s linear infinite';
                spinner.style.animation = 'none';

                requestAnimationFrame(() => {
                    spinner.style.animation = animationName;
                    // Ensure hardware acceleration
                    spinner.style.transform = 'translateZ(0)';
                    spinner.style.willChange = 'transform';
                });
            }
        });
    }

    /**
     * Check if all required steps are complete
     */
    private areAllStepsComplete(): boolean {
        return this.state.requiredSteps.every((step) => this.state.completedSteps.has(step));
    }

    /**
     * Update loading progress indicator
     */
    private updateProgress(): void {
        const progress = Math.min(
            100,
            (this.state.completedSteps.size / this.state.requiredSteps.length) * 100
        );

        // Use more robust DOM queries with error handling
        const percentageText = document.querySelector('.loading-percentage');
        const statusText = document.querySelector('.loading-status');

        if (percentageText) {
            const roundedProgress = Math.round(progress);
            percentageText.textContent = `${String(roundedProgress)}%`;

            // Debug: loading progress tracking for development
            if (process.env.NODE_ENV === 'development') {
                // Progress tracking: roundedProgress% (completed/total steps)
            }
        }

        if (statusText) {
            statusText.innerHTML = this.getStatusMessage();
        }

        // Force browser reflow to ensure updates are visible
        if (percentageText && percentageText instanceof HTMLElement) {
            void percentageText.offsetHeight; // Trigger reflow
        }
    }

    /**
     * Get current status message based on completed steps
     */
    private getStatusMessage(): string {
        const completedSteps = Array.from(this.state.completedSteps);
        const lastCompleted = completedSteps[completedSteps.length - 1];

        const statusMessages: Record<string, string> = {
            'app-initialized':
                'Application initialized<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'project-toolbar-initialized':
                'Project toolbar setup<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'themes-ready':
                'Themes loaded<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'chart-initialized':
                'Chart initialized<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'label-definitions-loaded':
                'Label definitions loaded<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'data-loaded':
                'Data loaded<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'dropdowns-setup':
                'UI components ready<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
            'ui-setup':
                'Finalizing setup&nbsp;<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
        };

        if (completedSteps.length === 0) {
            return 'Initializing application<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
        }

        return (
            (lastCompleted ? statusMessages[lastCompleted] : undefined) ||
            'Loading<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>'
        );
    }

    /**
     * Complete the loading process and hide the screen
     */
    private completeLoading(): void {
        if (this.state.isComplete || !this.loadingElement) return;

        this.state.isComplete = true;

        // Calculate remaining time to meet minimum display duration
        const elapsedTime = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.minDisplayTime - elapsedTime);

        // Wait for remaining time before starting fade out
        setTimeout(() => {
            if (!this.loadingElement) return;

            // Add completion class to trigger fade out animation
            this.loadingElement.classList.add('loading-complete');

            // Remove the loading screen from DOM after animation
            setTimeout(() => {
                if (this.loadingElement && this.loadingElement.parentNode) {
                    this.loadingElement.parentNode.removeChild(this.loadingElement);
                }
            }, 600); // Match CSS animation duration
        }, remainingTime);
    }

    /**
     * Force complete loading (for emergency use)
     */
    forceComplete(): void {
        if (this.state.isComplete) return;

        // Ensure progress shows 100% before forcing completion
        const percentageText = document.querySelector('.loading-percentage');
        if (percentageText) {
            percentageText.textContent = '100%';
        }

        this.completeLoading();
    }

    /**
     * Get current loading state for debugging
     */
    getLoadingState(): {
        isComplete: boolean;
        completedSteps: string[];
        remainingSteps: string[];
        progress: number;
    } {
        const completedSteps = Array.from(this.state.completedSteps);
        const remainingSteps = this.state.requiredSteps.filter(
            (step) => !this.state.completedSteps.has(step)
        );
        const progress = Math.min(
            100,
            (this.state.completedSteps.size / this.state.requiredSteps.length) * 100
        );

        return {
            isComplete: this.state.isComplete,
            completedSteps,
            remainingSteps,
            progress: Math.round(progress),
        };
    }
}

// Create global instance
let loadingManager: LoadingManager | null = null;

/**
 * Initialize the loading manager
 */
export function initializeLoadingScreen(): LoadingManager {
    if (!loadingManager) {
        loadingManager = new LoadingManager();
    }
    return loadingManager;
}

/**
 * Mark a loading step as complete
 */
export function markLoadingStepComplete(step: string): void {
    if (loadingManager) {
        loadingManager.markStepComplete(step);
    }
}

/**
 * Force complete the loading screen
 */
export function forceCompleteLoading(): void {
    if (loadingManager) {
        loadingManager.forceComplete();
    }
}

/**
 * Get current loading state for debugging
 */
export function getLoadingState(): {
    isComplete: boolean;
    completedSteps: string[];
    remainingSteps: string[];
    progress: number;
} | null {
    return loadingManager ? loadingManager.getLoadingState() : null;
}

// Auto-initialize when module loads
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    initializeLoadingScreen();
} else if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeLoadingScreen();
    });
}

// Add debug functions to window for manual testing
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    interface LoadingDebug {
        getState: typeof getLoadingState;
        markStep: typeof markLoadingStepComplete;
        forceComplete: typeof forceCompleteLoading;
        testProgress: () => void;
    }

    (window as unknown as { loadingScreenDebug: LoadingDebug }).loadingScreenDebug = {
        getState: getLoadingState,
        markStep: markLoadingStepComplete,
        forceComplete: forceCompleteLoading,
        testProgress: () => {
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

            let i = 0;
            const interval = setInterval(() => {
                if (i < steps.length) {
                    const step = steps[i];
                    if (step) {
                        markLoadingStepComplete(step);
                    }
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 500);
        },
    };
}
