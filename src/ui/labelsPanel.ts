/**
 * Labels panel UI management
 * Displays created time series labe        // Initialize sort order button
        this.sortOrderBtn = panel.querySelector('.sort-order-btn');
        if (this.sortOrderBtn) {
            this.sortOrderBtn.addEventListener('click', () => {
                this.toggleSortOrder();
            });
            this.updateSortOrderButton(); // Set initial state
        } interaction capabilities
 */

import type { TimeSeriesChart } from '../charts/timeSeries';
import type { TimeSeriesLabel } from '../domain/labels';

import { confirmDelete } from './confirmation';
import { getLabelDefinitions } from './dropdowns';
import { updateEmptyState } from './emptyStates';
import { addHistoryEntry } from './labelModal';

interface LabelPanelItem {
    element: HTMLElement;
    label: TimeSeriesLabel;
}

type SortBy = 'creation' | 'visibility' | 'range';
type SortOrder = 'asc' | 'desc';

export class LabelsPanel {
    private chart: TimeSeriesChart | null = null;
    private container: HTMLElement | null = null;
    private labelItems: Map<string, LabelPanelItem> = new Map();
    private currentHighlightedLabel: string | null = null;
    private currentSortBy: SortBy = 'creation';
    private currentSortOrder: SortOrder = 'asc';
    private sortDropdown: any = null; // TLDropdown element
    private sortOrderBtn: HTMLButtonElement | null = null;

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

        // Initialize sort dropdown
        this.sortDropdown = document.querySelector('#labels-sort');
        if (this.sortDropdown) {
            // Set dropdown options
            this.sortDropdown.options = [
                { value: 'creation', label: 'Creation order' },
                { value: 'visibility', label: 'Visibility' },
                { value: 'range', label: 'Time range' },
            ];

            // Set default value
            this.sortDropdown.value = 'creation';

            // Listen for changes
            this.sortDropdown.addEventListener('change', () => {
                this.currentSortBy = (this.sortDropdown?.value as SortBy) || 'creation';
                this.refreshLabels();
            });
        }

        // Initialize sort order button
        this.sortOrderBtn = document.querySelector('#labels-sort-order');
        if (this.sortOrderBtn) {
            this.sortOrderBtn.addEventListener('click', () => {
                this.toggleSortOrder();
            });
        }
    }

    /**
     * Bind global events
     */
    private bindEvents(): void {
        // Listen for window resizing to adjust positioning
        window.addEventListener('resize', () => {
            // Future: Handle responsive adjustments
        });

        // Listen for labels loaded from storage
        window.addEventListener('timelab:labelsChanged', () => {
            this.refreshLabels();
        });

        // Listen for time series labels changes (e.g., from label definition updates/deletions)
        window.addEventListener('timelab:timeSeriesLabelsChanged', () => {
            this.refreshLabels();
        });

        // Listen for label definitions being loaded from storage
        // This is crucial for fixing the reload issue where labels show IDs instead of names
        window.addEventListener('timelab:labelDefinitionsLoaded', () => {
            this.refreshLabels();
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

        // Add history entry for label creation
        this.addLabelCreationHistoryEntry(data.label);
    };

    /**
     * Add a history entry for label creation
     */
    private addLabelCreationHistoryEntry(label: TimeSeriesLabel): void {
        // Get the label definition to show the name in the history
        const labelDefinitions = getLabelDefinitions();
        const labelDef = labelDefinitions.find((def) => def.id === label.labelDefId);
        const labelName = labelDef?.name || this.getFallbackLabelName(label.labelDefId);

        // Format time range for display
        const timeRange = this.formatTimeRange(label.startTime, label.endTime);

        // Create a meaningful history message
        const action = `Applied "${labelName}" label to range ${timeRange}`;

        // Add the history entry (use void to ignore promise)
        void addHistoryEntry(action);
    }

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

        if (!this.chart) {
            this.updateEmptyState();
            return;
        }

        const currentSource = this.chart.getCurrentSource();
        if (!currentSource) {
            this.updateEmptyState();
            return;
        }

        const labels = currentSource.getLabels();
        const sortedLabels = this.sortLabels([...labels]);

        // Add labels back to the panel
        sortedLabels.forEach((label) => {
            this.addLabelToPanel(label);
        });

        this.updateEmptyState();
    }

    /**
     * Toggle sort order between ascending and descending
     */
    private toggleSortOrder(): void {
        this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
        this.updateSortOrderButton();
        this.refreshLabels();
    }

    /**
     * Update the sort order button appearance
     */
    private updateSortOrderButton(): void {
        if (!this.sortOrderBtn) return;

        const isAscending = this.currentSortOrder === 'asc';
        const icon = this.sortOrderBtn.querySelector('.material-symbols-outlined');

        if (icon) {
            icon.textContent = isAscending ? 'arrow_upward' : 'arrow_downward';
        }

        this.sortOrderBtn.setAttribute(
            'aria-label',
            isAscending ? 'Sort ascending' : 'Sort descending'
        );
        this.sortOrderBtn.setAttribute(
            'title',
            `Currently sorting ${isAscending ? 'ascending' : 'descending'}. Click to toggle.`
        );
    }

    /**
     * Sort labels based on current sort criteria and order
     */
    private sortLabels(labels: TimeSeriesLabel[]): TimeSeriesLabel[] {
        let sortedLabels: TimeSeriesLabel[];

        switch (this.currentSortBy) {
            case 'creation':
                sortedLabels = labels.sort((a, b) => a.createdAt - b.createdAt);
                break;

            case 'visibility':
                sortedLabels = labels.sort((a, b) => {
                    const aVisible = a.visible !== false;
                    const bVisible = b.visible !== false;
                    if (aVisible === bVisible) {
                        // If visibility is the same, sort by creation order
                        return a.createdAt - b.createdAt;
                    }
                    // Visible labels first
                    return bVisible ? 1 : -1;
                });
                break;

            case 'range':
                sortedLabels = labels.sort((a, b) => {
                    const startDiff = a.startTime - b.startTime;
                    if (startDiff !== 0) return startDiff;
                    // If start times are equal, sort by end time
                    return a.endTime - b.endTime;
                });
                break;

            default:
                sortedLabels = labels;
        }

        // Apply sort order (reverse for descending)
        return this.currentSortOrder === 'desc' ? sortedLabels.reverse() : sortedLabels;
    }

    /**
     * Add a single label to the panel
     */
    private addLabelToPanel(label: TimeSeriesLabel): void {
        if (!this.container || this.labelItems.has(label.id)) return;

        const labelItem = this.createLabelItem(label);
        this.labelItems.set(label.id, { element: labelItem, label });

        // Simply append since labels are pre-sorted
        this.container.appendChild(labelItem);

        this.updateEmptyState();
    }

    /**
     * Create a label item element
     */
    private createLabelItem(label: TimeSeriesLabel): HTMLElement {
        const labelDefinitions = getLabelDefinitions();

        // Try to find label definition by UUID first, then fall back to legacy index format
        let labelDef = labelDefinitions.find((def) => def.id === label.labelDefId);

        if (!labelDef) {
            // Fallback for legacy format "label-{index}"
            const labelDefMatch = label.labelDefId.match(/^label-(\d+)$/);
            if (labelDefMatch?.[1]) {
                const index = parseInt(labelDefMatch[1], 10);
                labelDef = labelDefinitions[index];
            }
        }

        const labelName = labelDef?.name || this.getFallbackLabelName(label.labelDefId);
        const labelColor = labelDef?.color || this.getFallbackLabelColor(label.labelDefId);

        // Format time range based on data type
        const timeRange = this.formatTimeRange(label.startTime, label.endTime);

        const item = document.createElement('li');
        item.className = 'label-item';
        item.setAttribute('data-label-id', label.id);
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');

        // Determine visibility state (default to visible if undefined)
        const isVisible = label.visible !== false;
        const visibilityIcon = isVisible ? 'visibility' : 'visibility_off';
        const visibilityTitle = isVisible ? 'Hide label' : 'Show label';

        // Add muted class for hidden labels
        if (!isVisible) {
            item.classList.add('hidden');
        }

        item.innerHTML = `
            <span class="dot" style="--dot: ${labelColor}"></span>
            <div class="meta">
                <div class="title">${labelName}</div>
                <div class="range">${timeRange}</div>
            </div>
            <div class="actions">
                <button class="visibility btn-icon" aria-label="${visibilityTitle} ${labelName}" title="${visibilityTitle}">
                    <span class="material-symbols-outlined">${visibilityIcon}</span>
                </button>
                <button class="delete btn-icon" aria-label="Delete ${labelName} label" title="Delete label">
                    <span class="material-symbols-outlined">delete</span>
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
            if (
                (e.target as HTMLElement).closest('.delete') ||
                (e.target as HTMLElement).closest('.visibility')
            ) {
                return; // Let action buttons handle their own clicks
            }
            this.focusLabelOnChart(label);
        });

        // Visibility toggle button
        const visibilityBtn = item.querySelector('.visibility') as HTMLElement;
        if (visibilityBtn) {
            visibilityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLabelVisibility(label);
            });
        }

        // Delete button
        const deleteBtn = item.querySelector('.delete') as HTMLElement;
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
        const labelDef = labelDefinitions.find((def) => def.id === label.labelDefId);
        const labelName = labelDef?.name || this.getFallbackLabelName(label.labelDefId);

        // Use custom confirmation modal instead of browser confirm()
        const confirmed = await confirmDelete(labelName, 'label');
        if (confirmed) {
            this.deleteLabel(label);
        }
    } /**
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
        const lastConfig = this.chart?.getLastConfig();
        if (this.chart && lastConfig) {
            // Use the proper updateDisplay method instead of forcing option reset
            this.chart.updateDisplay(lastConfig);
        }

        this.updateEmptyState();
    }

    /**
     * Toggle visibility of a label
     */
    private toggleLabelVisibility(label: TimeSeriesLabel): void {
        if (!this.chart) return;

        // Toggle visibility through the chart
        this.chart.toggleLabelVisibility(label.id);

        // Update the UI element to reflect new visibility state without full refresh
        const labelItem = this.labelItems.get(label.id);
        if (labelItem) {
            // Get the updated label from the data source
            const currentSource = this.chart.getCurrentSource();
            if (currentSource) {
                const updatedLabels = currentSource.getLabels();
                const updatedLabel = updatedLabels.find((l) => l.id === label.id);
                if (updatedLabel) {
                    // Update the stored label reference
                    labelItem.label = updatedLabel;

                    // Update the visual state of the existing element
                    this.updateLabelItemVisualState(labelItem.element, updatedLabel);
                }
            }
        }
    }

    /**
     * Update the visual state of a label item element
     */
    private updateLabelItemVisualState(element: HTMLElement, label: TimeSeriesLabel): void {
        const isVisible = label.visible !== false;

        // Update CSS class for hidden state
        if (isVisible) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }

        // Update visibility button icon and title
        const visibilityBtn = element.querySelector('.visibility');
        const visibilityIcon = visibilityBtn?.querySelector('.material-symbols-outlined');
        if (visibilityIcon && visibilityBtn) {
            visibilityIcon.textContent = isVisible ? 'visibility' : 'visibility_off';
            const labelDefinitions = getLabelDefinitions();
            const labelDef = labelDefinitions.find((def) => def.id === label.labelDefId);
            const labelName = labelDef?.name || `Label ${label.labelDefId}`;
            const visibilityTitle = isVisible ? 'Hide label' : 'Show label';
            visibilityBtn.setAttribute('aria-label', `${visibilityTitle} ${labelName}`);
            visibilityBtn.setAttribute('title', visibilityTitle);
        }
    }

    /**
     * Highlight a label on the chart (visual emphasis)
     */
    private highlightLabelOnChart(labelId: string): void {
        if (this.currentHighlightedLabel === labelId) return;

        this.currentHighlightedLabel = labelId;

        if (this.chart && 'highlightLabel' in this.chart) {
            (this.chart as any).highlightLabel(labelId);
        }
    }

    /**
     * Clear chart label highlighting
     */
    private clearChartHighlight(): void {
        if (!this.currentHighlightedLabel) return;

        this.currentHighlightedLabel = null;

        if (this.chart && 'clearLabelHighlight' in this.chart) {
            (this.chart as any).clearLabelHighlight();
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

        updateEmptyState(this.container, '.label-item:not(.empty-state)', {
            icon: 'label_off',
            title: 'No labels created',
            subtitle: 'Create your first label to get started',
            className: 'labels-empty',
        });
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

        // Check if we have a predefined fallback
        if (fallbackNames[labelDefId]) {
            return fallbackNames[labelDefId];
        }

        // For UUIDs, show a user-friendly placeholder instead of the raw UUID
        if (labelDefId.startsWith('def-') || labelDefId.includes('-')) {
            return 'Loading...'; // More user-friendly than showing UUID
        }

        // For legacy format labels, show the ID
        return labelDefId;
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

        // Check if we have a predefined fallback
        if (fallbackColors[labelDefId]) {
            return fallbackColors[labelDefId];
        }

        // For UUIDs, use a muted color to indicate loading state
        if (labelDefId.startsWith('def-') || labelDefId.includes('-')) {
            return '#9ca3af'; // Gray color indicating loading/temporary state
        }

        // Default blue for other cases
        return '#007bff';
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
