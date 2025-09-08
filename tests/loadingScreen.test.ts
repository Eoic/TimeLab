/**
 * Tests for loading screen functionality
 * Ensures proper progress tracking and completion behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DOM with proper typing
const createMockElement = (initialTextContent = '') => {
    const element = {
        textContent: initialTextContent,
        innerHTML: '',
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(),
        },
        parentNode: {
            removeChild: vi.fn(),
        },
        offsetHeight: 100,
    };
    return element;
};

const mockLoadingElement = createMockElement();
const mockProgressElement = createMockElement('0%');
const mockStatusElement = createMockElement();

// Mock timers
vi.useFakeTimers();

// Reset module state before each test
beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Reset DOM element states
    mockProgressElement.textContent = '0%';
    mockStatusElement.innerHTML = '';

    // Mock DOM methods
    vi.spyOn(document, 'getElementById').mockReturnValue(mockLoadingElement as any);
    vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        if (selector === '.loading-percentage') return mockProgressElement as any;
        if (selector === '.loading-status') return mockStatusElement as any;
        return null;
    });

    // Reset module - force reimport
    vi.resetModules();
});

describe('LoadingScreen Progress Calculation', () => {
    it('should start at 0% progress', async () => {
        const { initializeLoadingScreen } = await import('../src/ui/loadingScreen');
        initializeLoadingScreen();

        expect(mockProgressElement.textContent).toBe('0%');
    });

    it('should calculate correct progress for each step', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        // 1 out of 8 steps = 12.5% → 13%
        markLoadingStepComplete('app-initialized');
        expect(mockProgressElement.textContent).toBe('13%');

        // 2 out of 8 steps = 25%
        markLoadingStepComplete('project-toolbar-initialized');
        expect(mockProgressElement.textContent).toBe('25%');

        // 4 out of 8 steps = 50%
        markLoadingStepComplete('ui-setup');
        markLoadingStepComplete('chart-initialized');
        expect(mockProgressElement.textContent).toBe('50%');
    });

    it('should reach exactly 100% when all steps complete', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        const allSteps = [
            'app-initialized',
            'project-toolbar-initialized',
            'ui-setup',
            'chart-initialized',
            'dropdowns-setup',
            'data-loaded',
            'themes-ready',
            'label-definitions-loaded',
        ];

        allSteps.forEach((step) => {
            markLoadingStepComplete(step);
        });

        expect(mockProgressElement.textContent).toBe('100%');
    });

    it('should not exceed 100% with extra steps', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        // Complete all required steps plus extras
        const steps = [
            'app-initialized',
            'project-toolbar-initialized',
            'ui-setup',
            'chart-initialized',
            'dropdowns-setup',
            'data-loaded',
            'themes-ready',
            'label-definitions-loaded',
            'extra-step-1',
            'extra-step-2',
        ];

        steps.forEach((step) => {
            markLoadingStepComplete(step);
        });

        expect(mockProgressElement.textContent).toBe('100%');
    });

    it('should handle duplicate steps correctly', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        // Mark same step multiple times
        markLoadingStepComplete('app-initialized');
        markLoadingStepComplete('app-initialized');
        markLoadingStepComplete('app-initialized');

        // Should still be 1/8 = 12.5% → 13%
        expect(mockProgressElement.textContent).toBe('13%');
    });
});

describe('LoadingScreen Completion Behavior', () => {
    it('should complete loading after all steps with delay', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        const allSteps = [
            'app-initialized',
            'project-toolbar-initialized',
            'ui-setup',
            'chart-initialized',
            'dropdowns-setup',
            'data-loaded',
            'themes-ready',
            'label-definitions-loaded',
        ];

        allSteps.forEach((step) => {
            markLoadingStepComplete(step);
        });

        // Should have a 100ms delay before completion
        expect(mockLoadingElement.classList.add).not.toHaveBeenCalled();

        // Fast forward past the delay
        vi.advanceTimersByTime(100);

        expect(mockLoadingElement.classList.add).toHaveBeenCalledWith('loading-complete');
    });

    it('should force complete with 100% progress', async () => {
        const { initializeLoadingScreen, forceCompleteLoading } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        // Force complete without completing all steps
        forceCompleteLoading();

        // Should show 100% progress
        expect(mockProgressElement.textContent).toBe('100%');
        expect(mockLoadingElement.classList.add).toHaveBeenCalledWith('loading-complete');
    });

    it('should timeout and force complete after 10 seconds', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { initializeLoadingScreen } = await import('../src/ui/loadingScreen');

        initializeLoadingScreen();

        // Fast forward to timeout
        vi.advanceTimersByTime(10000);

        expect(consoleSpy).toHaveBeenCalledWith('Loading timeout reached, forcing completion');
        expect(mockLoadingElement.classList.add).toHaveBeenCalledWith('loading-complete');

        consoleSpy.mockRestore();
    });
});

describe('LoadingScreen Status Messages', () => {
    it('should show initial status message', async () => {
        const { initializeLoadingScreen } = await import('../src/ui/loadingScreen');

        initializeLoadingScreen();

        expect(mockStatusElement.innerHTML).toContain('Initializing application');
        expect(mockStatusElement.innerHTML).toContain('loading-dots');
    });

    it('should update status message with step completion', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        markLoadingStepComplete('app-initialized');
        expect(mockStatusElement.innerHTML).toContain('Application initialized');

        markLoadingStepComplete('chart-initialized');
        expect(mockStatusElement.innerHTML).toContain('Chart initialized');
    });
});

describe('LoadingScreen Edge Cases', () => {
    it('should handle missing DOM elements gracefully', async () => {
        // Mock missing loading screen element
        vi.spyOn(document, 'getElementById').mockReturnValue(null);
        vi.spyOn(document, 'querySelector').mockReturnValue(null);

        const { initializeLoadingScreen, markLoadingStepComplete } = await import(
            '../src/ui/loadingScreen'
        );

        expect(() => {
            initializeLoadingScreen();
            markLoadingStepComplete('app-initialized');
        }).not.toThrow();
    });

    it('should not complete multiple times', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete, forceCompleteLoading } =
            await import('../src/ui/loadingScreen');

        initializeLoadingScreen();

        // Complete normally
        const allSteps = [
            'app-initialized',
            'project-toolbar-initialized',
            'ui-setup',
            'chart-initialized',
            'dropdowns-setup',
            'data-loaded',
            'themes-ready',
            'label-definitions-loaded',
        ];

        allSteps.forEach((step) => {
            markLoadingStepComplete(step);
        });

        // Wait for completion delay
        vi.advanceTimersByTime(100);

        // Try to force complete again
        forceCompleteLoading();

        // Should only add class once
        expect(mockLoadingElement.classList.add).toHaveBeenCalledTimes(1);
    });
});

describe('LoadingScreen Debug State', () => {
    it('should provide accurate debug state', async () => {
        const { initializeLoadingScreen, markLoadingStepComplete, getLoadingState } = await import(
            '../src/ui/loadingScreen'
        );

        initializeLoadingScreen();

        let state = getLoadingState();
        expect(state).toEqual({
            isComplete: false,
            completedSteps: [],
            remainingSteps: [
                'app-initialized',
                'project-toolbar-initialized',
                'ui-setup',
                'chart-initialized',
                'dropdowns-setup',
                'data-loaded',
                'themes-ready',
                'label-definitions-loaded',
            ],
            progress: 0,
        });

        markLoadingStepComplete('app-initialized');
        markLoadingStepComplete('chart-initialized');

        state = getLoadingState();
        expect(state?.completedSteps).toEqual(['app-initialized', 'chart-initialized']);
        expect(state?.progress).toBe(25); // 2/8 = 25%
        expect(state?.remainingSteps).toHaveLength(6);
    });
});
