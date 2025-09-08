/**
 * Application entry point following the engineering guide structure
 */

import { bootstrapApplication } from './app';
import { initializeTimeSeriesChart } from './charts/timeSeries';
import { getDataManager } from './data';
import { setupDropdowns, setupLabelsEmptyStates, loadLabelDefinitions } from './ui';
import { setupLabelManagement } from './ui/labelManagement';
import { setupLabelModal, setupModalTriggers, loadHistoryEntries } from './ui/labelModal';
import { setupLabelsPanel } from './ui/labelsPanel';
import { initializeLoadingScreen, markLoadingStepComplete } from './ui/loadingScreen';
import { initializeProjectToolbar } from './ui/projectToolbar';

import { setupUploads } from '@/data/uploads';
import { setupSettings } from '@/settings';
import { setupCheckboxEnterToggle } from '@/ui/checkboxAccessibility';
import { setupCollapsiblePanels } from '@/ui/collapsiblePanels';
import { defineDropdown } from '@/ui/dropdown';
import { setupRangeProgress } from '@/ui/rangeInputs';
import { setupStatsPanel } from '@/ui/statsPanel';

import './styles/main.scss';

/**
 * Main application initialization with loading screen integration
 */
async function initializeApplication(): Promise<void> {
    // Initialize loading screen
    initializeLoadingScreen();

    try {
        // Bootstrap app with services
        await bootstrapApplication();
        defineDropdown();
        markLoadingStepComplete('app-initialized');

        // Initialize project management toolbar
        const projectToolbarContainer = document.getElementById('project-toolbar-container');
        if (projectToolbarContainer) {
            const projectToolbar = initializeProjectToolbar(projectToolbarContainer);
            await projectToolbar.initialize();
        }
        markLoadingStepComplete('project-toolbar-initialized');

        // Initialize themes and settings first
        setupSettings();
        markLoadingStepComplete('themes-ready');

        // Initialize empty chart
        const timeSeriesChart = initializeTimeSeriesChart();
        markLoadingStepComplete('chart-initialized');

        // Setup advanced labels panel with highlighting BEFORE loading definitions
        // so it can receive the labelDefinitionsLoaded event
        setupLabelsPanel(timeSeriesChart);

        // Load label definitions early to ensure they're available when labels are displayed
        await loadLabelDefinitions();
        markLoadingStepComplete('label-definitions-loaded');

        // Connect data manager to chart
        const dataManager = getDataManager();
        dataManager.onDataChanged((sources) => {
            timeSeriesChart.setDataSources(sources);
        });

        // Load initial data if available
        const sourcesResult = await dataManager.getDataSources();
        if (sourcesResult.ok) {
            timeSeriesChart.setDataSources(sourcesResult.value);
        } else {
            // Failed to load initial data sources, continuing with empty chart
        }
        // Always mark as complete to not block loading
        markLoadingStepComplete('data-loaded');

        // Setup UI components
        setupDropdowns();
        setupCollapsiblePanels();
        setupStatsPanel();
        setupLabelsEmptyStates();
        setupRangeProgress();
        setupCheckboxEnterToggle();
        setupUploads();
        setupLabelModal();
        setupLabelManagement();
        setupModalTriggers();
        markLoadingStepComplete('dropdowns-setup');

        // Load persisted data
        try {
            await loadHistoryEntries();
            markLoadingStepComplete('ui-setup');
        } catch (_error: unknown) {
            // Failed to load history entries, continuing without history
            markLoadingStepComplete('ui-setup');
        }

        // Expose for debugging in development
        if (process.env.NODE_ENV === 'development') {
            const { resetDatabase } = await import('./platform/storage');
            (
                window as unknown as {
                    __timeSeriesController?: typeof timeSeriesChart;
                    __resetDatabase?: () => Promise<void>;
                }
            ).__timeSeriesController = timeSeriesChart;

            // Expose database reset function for debugging storage issues
            (
                window as unknown as {
                    __timeSeriesController?: typeof timeSeriesChart;
                    __resetDatabase?: () => Promise<void>;
                }
            ).__resetDatabase = async () => {
                const result = await resetDatabase();
                if (result.ok) {
                    // Database reset successfully, refresh page manually
                } else {
                    // Failed to reset database, check browser console for details
                }
            };
        }
    } catch (_error: unknown) {
        // Failed to initialize application, forcing loading completion to prevent stuck state
        // Force complete loading even on error to not leave user stuck
        const { forceCompleteLoading } = await import('./ui/loadingScreen');
        forceCompleteLoading();
    }
}

// Start application initialization
void initializeApplication();
