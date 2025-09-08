/**
 * Data manager that connects uploaded CSV files to the chart system
 */

import type { TimeSeriesData, DataManager } from '../charts/timeSeries';
import type { Result } from '../shared/result';
import { ok } from '../shared/result';

import { convertDataFilesToTimeSeries } from './csvProcessor';
import type { TDataFile } from './uploads';

/**
 * Implementation of DataManager that listens to uploaded data files
 */
export class UploadDataManager implements DataManager {
    private dataSources: ReadonlyArray<TimeSeriesData> = [];
    private callbacks = new Set<(sources: readonly TimeSeriesData[]) => void>();
    private boundHandler = this.handleDataFilesChanged.bind(this);

    constructor() {
        window.addEventListener('timelab:dataFilesChanged', this.boundHandler);
        this.loadInitialData();
    }

    /**
     * Clean up resources and event listeners to prevent memory leaks
     */
    destroy(): void {
        window.removeEventListener('timelab:dataFilesChanged', this.boundHandler);
        this.callbacks.clear();
    }

    getDataSources(): Promise<Result<readonly TimeSeriesData[]>> {
        return Promise.resolve(ok([...this.dataSources]));
    }

    onDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void {
        this.callbacks.add(callback);
    }

    offDataChanged(callback: (sources: readonly TimeSeriesData[]) => void): void {
        this.callbacks.delete(callback);
    }

    private handleDataFilesChanged(event: Event): void {
        const customEvent = event as CustomEvent<{ files: TDataFile[] }>;
        const files = customEvent.detail.files;
        this.dataSources = convertDataFilesToTimeSeries(files);
        this.notifyDataChanged();
    }

    private loadInitialData(): void {
        const win = window as unknown as { __dataFiles?: TDataFile[] };

        if (Array.isArray(win.__dataFiles)) {
            this.dataSources = convertDataFilesToTimeSeries(win.__dataFiles);
            this.notifyDataChanged();
        }
    }

    private notifyDataChanged(): void {
        const sourcesCopy: readonly TimeSeriesData[] = [...this.dataSources];

        this.callbacks.forEach((callback) => {
            try {
                callback(sourcesCopy);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error in data change callback:', error);
            }
        });
    }
}

/**
 * Global data manager instance
 */
let globalDataManager: UploadDataManager | null = null;

/**
 * Get the global data manager instance
 */
export function getDataManager(): UploadDataManager {
    if (!globalDataManager) {
        globalDataManager = new UploadDataManager();
    }

    return globalDataManager;
}
