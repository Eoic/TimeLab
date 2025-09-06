/**
 * Application entry point following the engineering guide structure
 */

import { initializeApp } from './app';
import { initializeTimeSeriesChart } from './charts/timeSeries';
import { getDataManager } from './data';
import { setupDropdowns, setupLabelsEmptyStates } from './ui';
import { setupLabelManagement } from './ui/labelManagement';
import { setupLabelModal, setupModalTriggers, loadHistoryEntries } from './ui/labelModal';
import { setupLabelsPanel } from './ui/labelsPanel';
import { initializeLoadingScreen, markLoadingStepComplete } from './ui/loadingScreen';

import { setupCheckboxEnterToggle } from '@/a11y/checkbox';
import { defineDropdown } from '@/components/dropdown';
import { setupRangeProgress } from '@/inputs/range';
import { setupCollapsiblePanels } from '@/layout/panels';
import { setupSettings } from '@/settings';
import { setupStatsPanel } from '@/stats/panel';
import { setupSnapSettingsDropdown } from '@/toolbar/snap';
import { setupUploads } from '@/uploads';

import './styles/main.scss';

/**
 * Main application initialization with loading screen integration
 */
async function initializeApplication(): Promise<void> {
    // Initialize loading screen
    initializeLoadingScreen();

    try {
        // Initialize app
        initializeApp();
        defineDropdown();
        markLoadingStepComplete('app-initialized');

        // Initialize themes and settings first
        setupSettings();
        markLoadingStepComplete('themes-ready');

        // Initialize empty chart
        const timeSeriesChart = initializeTimeSeriesChart();
        markLoadingStepComplete('chart-initialized');

        // Setup advanced labels panel with highlighting (replaces simple version)
        setupLabelsPanel(timeSeriesChart);

        // Connect data manager to chart
        const dataManager = getDataManager();
        dataManager.onDataChanged((sources) => {
            timeSeriesChart.setDataSources(sources);
        });

        // Load initial data if available
        try {
            const sources = await dataManager.getDataSources();
            timeSeriesChart.setDataSources(sources);
            markLoadingStepComplete('data-loaded');
        } catch (error: unknown) {
            // eslint-disable-next-line no-console
            console.error('Failed to load initial data sources:', error);
            // Still mark as complete to not block loading
            markLoadingStepComplete('data-loaded');
        }

        // Setup UI components
        setupDropdowns();
        setupCollapsiblePanels();
        setupStatsPanel();
        setupLabelsEmptyStates();
        setupRangeProgress();
        setupSnapSettingsDropdown();
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
        } catch (error: unknown) {
            // eslint-disable-next-line no-console
            console.error('Failed to load history entries:', error);
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
                    // eslint-disable-next-line no-console
                    console.log('Database reset successfully. Please refresh the page.');
                } else {
                    // eslint-disable-next-line no-console
                    console.error('Failed to reset database:', result.error);
                }
            };
        }
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize application:', error);
        // Force complete loading even on error to not leave user stuck
        const { forceCompleteLoading } = await import('./ui/loadingScreen');
        forceCompleteLoading();
    }
}

// Start application initialization
void initializeApplication();
