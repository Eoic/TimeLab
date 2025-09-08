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

        // Auto-complete after a maximum timeout to prevent infinite loading
        setTimeout(() => {
            if (!this.state.isComplete) {
                // eslint-disable-next-line no-console
                console.warn('Loading timeout reached, forcing completion');
                this.completeLoading();
            }
        }, 10000); // 10 second timeout
    }

    /**
     * Mark a loading step as complete
     */
    markStepComplete(step: string): void {
        this.state.completedSteps.add(step);
        this.updateProgress();

        if (this.areAllStepsComplete()) {
            this.completeLoading();
        }
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
        const percentageText = document.querySelector('.loading-percentage') as HTMLElement;
        const statusText = document.querySelector('.loading-status') as HTMLElement;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM query can return null
        if (percentageText) {
            percentageText.textContent = `${String(Math.round(progress))}%`;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM query can return null
        if (statusText) {
            statusText.innerHTML = this.getStatusMessage();
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
        this.completeLoading();
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

// Auto-initialize when module loads
if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    initializeLoadingScreen();
} else if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeLoadingScreen();
    });
}
