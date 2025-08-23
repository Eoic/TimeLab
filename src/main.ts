import { setupCheckboxEnterToggle } from '@/a11y/checkbox';
import { setupTimeSeriesDemo } from '@/chart/timeSeries';
import { defineDropdown, type TLDropdown } from '@/components/dropdown';
import { setupRangeProgress } from '@/inputs/range';
import { setupCollapsiblePanels } from '@/layout/panels';
import { setupStatsPanel } from '@/stats/panel';
import { setupSnapSettingsDropdown } from '@/toolbar/snap';
import { setupDropdowns } from '@/ui/dropdowns';
import { setupUploads, type TDataFile } from '@/uploads';
import { setupApp } from '@/utils/app';
import '../styles/main.scss';

// Preload example dataset and broadcast to the app; prefer Winkel (X) and Total press force (Y)
async function preloadExample(): Promise<void> {
    try {
        const res = await fetch('/data/CurveDataExporter_Tool_LVPA-1_20250602_230.csv');
        if (!res.ok) return;
        const text = await res.text();
        const file: TDataFile = {
            id: 'example',
            name: 'CurveDataExporter_Tool_LVPA-1_20250602_230.csv',
            size: text.length,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            text,
        };
        const win = window as unknown as { __dataFiles?: TDataFile[] };
        win.__dataFiles = [file];
        window.dispatchEvent(
            new CustomEvent<{ files: TDataFile[] }>('timelab:dataFilesChanged', {
                detail: { files: [file] },
            })
        );
        // Apply preferred axes if controls already exist
        const xAxis = document.querySelector<TLDropdown>('#x-axis');
        const yAxis = document.querySelector<TLDropdown>('#y-axis');
        const xType = document.querySelector<TLDropdown>('#cfg-x-type');
        if (xAxis) xAxis.value = 'Winkel';
        if (yAxis) yAxis.value = 'Total press force';
        if (xType) xType.value = 'numeric';
        // Fire change events so chart and config react to programmatic updates
        if (xAxis) {
            xAxis.dispatchEvent(new CustomEvent('change', { detail: { value: xAxis.value } }));
        }
        if (yAxis) {
            yAxis.dispatchEvent(new CustomEvent('change', { detail: { value: yAxis.value } }));
        }
        if (xType) {
            xType.dispatchEvent(new CustomEvent('change', { detail: { value: xType.value } }));
        }
    } catch {
        // ignore if example is not available
    }
}

setupApp();

defineDropdown();

void setupTimeSeriesDemo();
setupDropdowns();
void preloadExample();
setupCollapsiblePanels();
setupStatsPanel();
setupRangeProgress();
setupSnapSettingsDropdown();
setupCheckboxEnterToggle();
setupUploads();
