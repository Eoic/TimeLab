/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UIEventHandler } from '@/charts/components/UIEventHandler';
import { TimeSeriesChart } from '@/charts/timeSeries';

// Mock the HTML structure that the snap toggle button needs
function setupMockDOM() {
    document.body.innerHTML = `
        <div id="chart-container"></div>
        <button id="btn-snap-toggle" 
                aria-pressed="true" 
                class="chart-tool active"
                title="Disable preview line snapping to data points"
                aria-label="Disable snap to data points">
            <span class="material-symbols-outlined">grid_on</span>
        </button>
    `;
}

describe('Snapping Toggle Integration', () => {
    let uiHandler: UIEventHandler;
    let mockChart: Partial<TimeSeriesChart>;

    beforeEach(() => {
        setupMockDOM();
        uiHandler = new UIEventHandler();

        // Create a minimal mock of TimeSeriesChart
        mockChart = {
            isLabelModeEnabled: vi.fn(() => false),
            getCurrentSeriesInfo: vi.fn(() => ({ index: 0, total: 1, labeled: false })),
            getDataSourceByIndex: vi.fn(() => null),
        };
    });

    it('should initialize snap button with correct default state', () => {
        const btnSnapToggle = document.getElementById('btn-snap-toggle') as HTMLButtonElement;

        // Initialize with default snapping enabled
        uiHandler.initializeSnapButton(true);

        expect(btnSnapToggle.getAttribute('aria-pressed')).toBe('true');
        expect(btnSnapToggle.classList.contains('active')).toBe(true);
        expect(btnSnapToggle.querySelector('.material-symbols-outlined')?.textContent).toBe(
            'grid_on'
        );
        expect(btnSnapToggle.title).toBe('Disable preview line snapping to data points');
    });

    it('should initialize snap button with disabled state', () => {
        const btnSnapToggle = document.getElementById('btn-snap-toggle') as HTMLButtonElement;

        // Initialize with snapping disabled
        uiHandler.initializeSnapButton(false);

        expect(btnSnapToggle.getAttribute('aria-pressed')).toBe('false');
        expect(btnSnapToggle.classList.contains('active')).toBe(false);
        expect(btnSnapToggle.querySelector('.material-symbols-outlined')?.textContent).toBe(
            'grid_off'
        );
        expect(btnSnapToggle.title).toBe('Enable preview line snapping to data points');
    });

    it('should emit snapping-toggled event when button is clicked', () => {
        const btnSnapToggle = document.getElementById('btn-snap-toggle') as HTMLButtonElement;
        let emittedEvent: { enabled: boolean } | null = null;

        // Initialize handler
        uiHandler.initialize(mockChart as TimeSeriesChart);

        // Set up event listener to capture emitted event
        uiHandler.on('snapping-toggled', (event) => {
            emittedEvent = event;
        });

        // Set initial state to enabled
        btnSnapToggle.setAttribute('aria-pressed', 'true');

        // Click the button
        btnSnapToggle.click();

        // Verify event was emitted with correct state
        expect(emittedEvent).not.toBeNull();
        expect(emittedEvent?.enabled).toBe(false); // Should toggle to disabled
    });

    it('should toggle button visual state when clicked', () => {
        const btnSnapToggle = document.getElementById('btn-snap-toggle') as HTMLButtonElement;

        // Initialize handler
        uiHandler.initialize(mockChart as TimeSeriesChart);

        // Set initial enabled state
        btnSnapToggle.setAttribute('aria-pressed', 'true');
        btnSnapToggle.classList.add('active');

        // Click to toggle
        btnSnapToggle.click();

        // Check the button state changed
        expect(btnSnapToggle.getAttribute('aria-pressed')).toBe('false');
        expect(btnSnapToggle.classList.contains('active')).toBe(false);
        expect(btnSnapToggle.querySelector('.material-symbols-outlined')?.textContent).toBe(
            'grid_off'
        );
        expect(btnSnapToggle.title).toBe('Enable preview line snapping to data points');
    });

    it('should handle missing button gracefully', () => {
        // Remove the button
        document.getElementById('btn-snap-toggle')?.remove();

        // Should not throw when button doesn't exist
        expect(() => {
            uiHandler.initializeSnapButton(true);
        }).not.toThrow();

        expect(() => {
            uiHandler.initialize(mockChart as TimeSeriesChart);
        }).not.toThrow();
    });
});
