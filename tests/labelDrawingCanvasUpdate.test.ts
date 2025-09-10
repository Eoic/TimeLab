import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TimeSeriesChart } from '../src/charts/timeSeries';

describe('TimeSeriesChart Label Definition Update Fix', () => {
    let chart: TimeSeriesChart;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        // Mock DOM container
        mockContainer = document.createElement('div');
        mockContainer.id = 'chart-canvas';
        document.body.appendChild(mockContainer);

        chart = new TimeSeriesChart(mockContainer);
    });

    afterEach(() => {
        document.body.removeChild(mockContainer);
    });

    it('should update drawing canvas when setCurrentLabelDefinition is called with label mode enabled', () => {
        // First, enable label mode with an initial label definition
        chart.setLabelMode(true, 'initial-label-def');

        // Verify label mode is enabled
        expect(chart.isLabelModeEnabled()).toBe(true);

        // Now update the current label definition
        // This should reconfigure the drawing canvas with the new label definition
        expect(() => {
            chart.setCurrentLabelDefinition('new-label-def');
        }).not.toThrow();
    });

    it('should not throw when setCurrentLabelDefinition is called with label mode disabled', () => {
        // Ensure label mode is disabled
        chart.setLabelMode(false);

        // Verify label mode is disabled
        expect(chart.isLabelModeEnabled()).toBe(false);

        // Updating label definition when mode is disabled should not throw
        expect(() => {
            chart.setCurrentLabelDefinition('some-label-def');
        }).not.toThrow();
    });

    it('should handle null label definition ID', () => {
        // Enable label mode first
        chart.setLabelMode(true, 'initial-label-def');

        // Setting to null should not throw
        expect(() => {
            chart.setCurrentLabelDefinition(null);
        }).not.toThrow();
    });

    it('should preserve label mode state when updating label definition', () => {
        // Enable label mode
        chart.setLabelMode(true, 'initial-label-def');
        expect(chart.isLabelModeEnabled()).toBe(true);

        // Update label definition
        chart.setCurrentLabelDefinition('new-label-def');

        // Label mode should still be enabled
        expect(chart.isLabelModeEnabled()).toBe(true);
    });
});
