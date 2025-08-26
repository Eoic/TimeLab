/**
 * Application entry point following the engineering guide structure
 */

import { initializeApp } from './app';
import { initializeTimeSeriesChart } from './charts/timeSeries';
import { getDataManager } from './data';
import { setupDropdowns, setupLabelsEmptyStates } from './ui';
import { setupLabelManagement } from './ui/labelManagement';
import { setupLabelModal, setupModalTriggers } from './ui/labelModal';

import { setupCheckboxEnterToggle } from '@/a11y/checkbox';
import { defineDropdown } from '@/components/dropdown';
import { setupRangeProgress } from '@/inputs/range';
import { setupCollapsiblePanels } from '@/layout/panels';
import { setupSettings } from '@/settings';
import { setupStatsPanel } from '@/stats/panel';
import { setupSnapSettingsDropdown } from '@/toolbar/snap';
import { setupUploads } from '@/uploads';

import './styles/main.scss';

// Initialize app
initializeApp();
defineDropdown();

// Initialize empty chart
const timeSeriesChart = initializeTimeSeriesChart();

// Connect data manager to chart
const dataManager = getDataManager();
dataManager.onDataChanged((sources) => {
    timeSeriesChart.setDataSources(sources);
});

// Load initial data if available
dataManager
    .getDataSources()
    .then((sources) => {
        timeSeriesChart.setDataSources(sources);
    })
    .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load initial data sources:', error);
    });

// Expose for debugging in development
if (process.env.NODE_ENV === 'development') {
    (
        window as unknown as { __timeSeriesController?: typeof timeSeriesChart }
    ).__timeSeriesController = timeSeriesChart;
}

// Setup UI components
setupDropdowns();
setupSettings();
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
