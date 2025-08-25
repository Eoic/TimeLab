import { setupCheckboxEnterToggle } from '@/a11y/checkbox';
import { initializeTimeSeriesChart } from '@/chart/timeSeries';
import { defineDropdown } from '@/components/dropdown';
import { setupRangeProgress } from '@/inputs/range';
import { setupCollapsiblePanels } from '@/layout/panels';
import { setupSettings } from '@/settings';
import { setupStatsPanel } from '@/stats/panel';
import { setupSnapSettingsDropdown } from '@/toolbar/snap';
import { setupDropdowns } from '@/ui/dropdowns';
import { setupLabelsEmptyStates } from '@/ui/emptyStates';
import { setupUploads } from '@/uploads';
import { setupApp } from '@/utils/app';
import '../styles/main.scss';

setupApp();
defineDropdown();

// Initialize empty chart
const timeSeriesChart = initializeTimeSeriesChart();

// Expose for debugging
(window as unknown as { __timeSeriesController?: typeof timeSeriesChart }).__timeSeriesController =
    timeSeriesChart;

setupDropdowns();
setupSettings();
setupCollapsiblePanels();
setupStatsPanel();
setupLabelsEmptyStates();
setupRangeProgress();
setupSnapSettingsDropdown();
setupCheckboxEnterToggle();
setupUploads();
