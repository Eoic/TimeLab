/**
 * Labels panel UI management
 * Displays created time series labels with interaction capabilities
 */

import type { TimeSeriesChart } from '../charts/timeSeries';
import type { TimeSeriesLabel } from '../domain/labels';

import { getLabelDefinitions } from './dropdowns';

interface LabelPanelItem {
    element: HTMLElement;
    label: TimeSeriesLabel;
}

export class LabelsPanel {
    private chart: TimeSeriesChart | null = null;
    private container: HTMLElement | null = null;
    private labelItems: Map<string, LabelPanelItem> = new Map();
    private currentHighlightedLabel: string | null = null;

    constructor() {
        this.setupPanelContainer();
        this.bindEvents();
    }

    /**
     * Initialize the labels panel
     */
    private setupPanelContainer(): void {
        this.container = document.querySelector('.labels-list');
        if (!this.container) {
            console.warn('Labels panel container (.labels-list) not found');
            return;
        }

        // Ensure proper styling
        this.container.className = 'labels-list';
        this.container.setAttribute('role', 'listbox');
        this.container.setAttribute('aria-label', 'Time series labels');
    }

    /**
     * Bind global events
     */
    private bindEvents(): void {
        // Listen for window resizing to adjust positioning
        window.addEventListener('resize', () => {
            // Future: Handle responsive adjustments
        });
    }

    /**
     * Connect to a chart instance
     */
    connectToChart(chart: TimeSeriesChart): void {
        // Disconnect from previous chart
        if (this.chart) {
            this.chart.off('label-drawn', this.handleLabelDrawn);
            this.chart.off('series-changed', this.handleSeriesChanged);
        }

        this.chart = chart;

        // Listen for label events
        this.chart.on('label-drawn', this.handleLabelDrawn);
        this.chart.on('series-changed', this.handleSeriesChanged);

        // Initial refresh
        this.refreshLabels();
    }

    /**
     * Handle new label creation
     */
    private handleLabelDrawn = (data: { label: TimeSeriesLabel }): void => {
        this.addLabelToPanel(data.label);
    };

    /**
     * Handle series changes to refresh labels for new series
     */
    private handleSeriesChanged = (): void => {
        this.refreshLabels();
    };

    /**
     * Refresh all labels for current series
     */
    private refreshLabels(): void {
        this.clearLabels();

        if (!this.chart) return;

        const currentSource = this.chart.getCurrentSource();
        if (!currentSource) return;

        const labels = currentSource.getLabels();
        labels.forEach((label) => {
            this.addLabelToPanel(label);
        });

        this.updateEmptyState();
    }

    /**
     * Add a single label to the panel
     */
    private addLabelToPanel(label: TimeSeriesLabel): void {
        if (!this.container || this.labelItems.has(label.id)) return;

        const labelItem = this.createLabelItem(label);
        this.labelItems.set(label.id, { element: labelItem, label });

        // Insert in chronological order (by startTime)
        const existingItems = Array.from(this.container.children);
        const insertIndex = existingItems.findIndex((item) => {
            const itemLabelId = item.getAttribute('data-label-id');
            if (!itemLabelId) return false;

            const existingItem = this.labelItems.get(itemLabelId);
            return existingItem && existingItem.label.startTime > label.startTime;
        });

        if (insertIndex >= 0 && existingItems[insertIndex]) {
            this.container.insertBefore(labelItem, existingItems[insertIndex]);
        } else {
            this.container.appendChild(labelItem);
        }

        this.updateEmptyState();
    }

    /**
     * Create a label item element
     */
    private createLabelItem(label: TimeSeriesLabel): HTMLElement {
        const labelDefinitions = getLabelDefinitions();
        const labelDefMatch = label.labelDefId.match(/^label-(\d+)$/);
        const labelDef = labelDefMatch?.[1]
            ? labelDefinitions[parseInt(labelDefMatch[1], 10)]
            : null;

        const labelName = labelDef?.name || this.getFallbackLabelName(label.labelDefId);
        const labelColor = labelDef?.color || this.getFallbackLabelColor(label.labelDefId);

        // Format time range based on data type
        const timeRange = this.formatTimeRange(label.startTime, label.endTime);

        const item = document.createElement('li');
        item.className = 'label-item';
        item.setAttribute('data-label-id', label.id);
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        item.innerHTML = `
            <div class="label-item-content">
                <div class="label-item-header">
                    <span class="label-item-color" style="background-color: ${labelColor}"></span>
                    <span class="label-item-name">${labelName}</span>
                </div>
                <div class="label-item-range">${timeRange}</div>
                <button class="label-item-delete" aria-label="Delete ${labelName} label" title="Delete label">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/>
                    </svg>
                </button>
            </div>
        `;

        // Setup event listeners
        this.setupLabelItemEvents(item, label);

        return item;
    }

    /**
     * Setup event listeners for a label item
     */
    private setupLabelItemEvents(item: HTMLElement, label: TimeSeriesLabel): void {
        // Hover to highlight (mouse)
        item.addEventListener('mouseenter', () => {
            this.highlightLabelOnChart(label.id);
        });

        item.addEventListener('mouseleave', () => {
            this.clearChartHighlight();
        });

        // Touch support for mobile highlighting
        item.addEventListener('touchstart', () => {
            this.highlightLabelOnChart(label.id);
        });

        item.addEventListener('touchend', () => {
            // Clear highlight after a short delay to allow tap interaction
            setTimeout(() => {
                this.clearChartHighlight();
            }, 1000);
        });

        // Click to focus
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.label-item-delete')) {
                return; // Let delete button handle its own click
            }
            this.focusLabelOnChart(label);
        });

        // Delete button
        const deleteBtn = item.querySelector('.label-item-delete') as HTMLElement;
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteLabelWithConfirm(label);
            });
        }
    }

    /**
     * Delete a label with confirmation
     */
    private async deleteLabelWithConfirm(label: TimeSeriesLabel): Promise<void> {
        const labelDefinitions = getLabelDefinitions();
        const labelDefMatch = label.labelDefId.match(/^label-(\d+)$/);
        const labelDef = labelDefMatch?.[1]
            ? labelDefinitions[parseInt(labelDefMatch[1], 10)]
            : null;
        const labelName = labelDef?.name || 'this label';

        const confirmed = confirm(`Are you sure you want to delete "${labelName}"?`);
        if (!confirmed) return;

        this.deleteLabel(label);
    }

    /**
     * Delete a label
     */
    private deleteLabel(label: TimeSeriesLabel): void {
        if (!this.chart) return;

        const currentSource = this.chart.getCurrentSource();
        if (!currentSource) return;

        // Remove from data source
        currentSource.removeLabel(label.id);

        // Remove from UI
        const labelItem = this.labelItems.get(label.id);
        if (labelItem) {
            labelItem.element.remove();
            this.labelItems.delete(label.id);
        }

        // Clear any chart highlighting
        this.clearChartHighlight();

        // Refresh chart display to show updated labels
        const chart = this.chart.getChart();
        if (chart) {
            // Force chart to update by triggering a display refresh
            // This will rebuild the mark areas without the deleted label
            chart.setOption({}, true);
        }

        this.updateEmptyState();
    }

    /**
     * Highlight a label on the chart (visual emphasis)
     */
    private highlightLabelOnChart(labelId: string): void {
        if (this.currentHighlightedLabel === labelId) return;

        this.currentHighlightedLabel = labelId;

        if (this.chart) {
            this.chart.highlightLabel(labelId);
        }
    }

    /**
     * Clear chart label highlighting
     */
    private clearChartHighlight(): void {
        if (!this.currentHighlightedLabel) return;

        this.currentHighlightedLabel = null;

        if (this.chart) {
            this.chart.clearLabelHighlight();
        }
    }

    /**
     * Focus on a label in the chart (could implement zooming in future)
     */
    private focusLabelOnChart(label: TimeSeriesLabel): void {
        // For now, just highlight it
        this.highlightLabelOnChart(label.id);

        // Future enhancement: could zoom chart to show the label range
        // this.chart?.zoomToRange(label.startTime, label.endTime);
    }

    /**
     * Clear all labels from the panel
     */
    private clearLabels(): void {
        if (!this.container) return;

        this.labelItems.clear();
        this.container.innerHTML = '';
        this.currentHighlightedLabel = null;
    }

    /**
     * Update empty state visibility
     */
    private updateEmptyState(): void {
        if (!this.container) return;

        if (this.labelItems.size === 0) {
            this.showEmptyState();
        } else {
            // Remove empty state if it exists
            const emptyState = this.container.querySelector('.labels-empty-state');
            if (emptyState) {
                emptyState.remove();
            }
        }
    }

    /**
     * Show empty state
     */
    private showEmptyState(): void {
        if (!this.container) return;

        const emptyState = document.createElement('div');
        emptyState.className = 'labels-empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-content">
                <p>No labels created yet</p>
                <p class="empty-state-hint">Use label drawing mode to create time series labels</p>
            </div>
        `;

        this.container.appendChild(emptyState);
    }

    /**
     * Format time range for display
     */
    private formatTimeRange(startTime: number, endTime: number): string {
        const precision = this.getTimeDisplayPrecision(startTime, endTime);
        const start = startTime.toFixed(precision);
        const end = endTime.toFixed(precision);
        return `${start} - ${end}`;
    }

    /**
     * Get appropriate decimal precision for time display
     */
    private getTimeDisplayPrecision(startTime: number, endTime: number): number {
        const range = Math.abs(endTime - startTime);
        if (range >= 1000) return 0;
        if (range >= 100) return 1;
        if (range >= 10) return 2;
        return 3;
    }

    /**
     * Get fallback label name for unknown label definitions
     */
    private getFallbackLabelName(labelDefId: string): string {
        const fallbackNames: Record<string, string> = {
            'default-positive': 'Positive',
            'default-negative': 'Negative',
            'default-neutral': 'Neutral',
        };
        return fallbackNames[labelDefId] || labelDefId;
    }

    /**
     * Get fallback color for unknown label definitions
     */
    private getFallbackLabelColor(labelDefId: string): string {
        const fallbackColors: Record<string, string> = {
            'default-positive': '#28a745',
            'default-negative': '#dc3545',
            'default-neutral': '#6c757d',
        };
        return fallbackColors[labelDefId] || '#007bff';
    }
}

// Global instance
let labelsPanelInstance: LabelsPanel | null = null;

/**
 * Get the global labels panel instance
 */
export function getLabelsPanel(): LabelsPanel {
    if (!labelsPanelInstance) {
        labelsPanelInstance = new LabelsPanel();
    }
    return labelsPanelInstance;
}

/**
 * Initialize labels panel with chart
 */
export function setupLabelsPanel(chart: TimeSeriesChart): void {
    const panel = getLabelsPanel();
    panel.connectToChart(chart);
}
