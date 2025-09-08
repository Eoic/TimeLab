/**
 * Centralized data service that consolidates data management operations
 * Provides a unified interface for data sources, persistence, and processing
 */

import type { TimeSeriesData, DataManager } from '../charts/timeSeries';
import type { TimeSeriesLabel } from '../domain/labels';
import {
    getAllTimeSeriesLabels,
    saveTimeSeriesLabel,
    deleteTimeSeriesLabel,
    type IDBRecord,
} from '../platform/storage';
import { ok, err, DataValidationError, memoizeAsync, LRUCache } from '../shared';
import type { Result } from '../shared/result';

import { convertDataFilesToTimeSeries } from './csvProcessor';
import { UploadDataManager } from './dataManager';
import type { TDataFile } from './uploads';

/**
 * Data source metadata for enhanced data management
 */
export interface DataSourceMetadata {
    readonly id: string;
    readonly name: string;
    readonly fileName?: string | undefined;
    readonly size: number;
    readonly uploadDate: number;
    readonly type: 'csv' | 'json' | 'other';
    readonly columns: readonly string[];
    readonly rowCount: number;
}

/**
 * Data service events for reactive updates
 */
export interface DataServiceEvents {
    dataSourcesChanged: readonly TimeSeriesData[];
    dataSourceAdded: TimeSeriesData;
    dataSourceRemoved: string; // id
    labelsChanged: readonly TimeSeriesLabel[];
    labelAdded: TimeSeriesLabel;
    labelRemoved: string; // id
    metadataUpdated: DataSourceMetadata;
}

/**
 * Centralized data service interface
 */
export interface IDataService {
    // Data source management
    getDataSources(): Promise<Result<readonly TimeSeriesData[], DataValidationError>>;
    addDataSource(
        files: TDataFile[]
    ): Promise<Result<readonly TimeSeriesData[], DataValidationError>>;
    removeDataSource(id: string): Promise<Result<void, DataValidationError>>;
    getDataSourceMetadata(
        id: string
    ): Promise<Result<DataSourceMetadata | null, DataValidationError>>;
    refreshDataSources(): Promise<Result<readonly TimeSeriesData[], DataValidationError>>;

    // Label management
    getLabelsForDataSource(
        dataSourceId: string
    ): Promise<Result<readonly TimeSeriesLabel[], DataValidationError>>;
    addLabel(
        dataSourceId: string,
        label: TimeSeriesLabel
    ): Promise<Result<void, DataValidationError>>;
    removeLabel(labelId: string): Promise<Result<void, DataValidationError>>;
    updateLabel(
        labelId: string,
        updates: Partial<TimeSeriesLabel>
    ): Promise<Result<TimeSeriesLabel, DataValidationError>>;

    // Event handling
    on<K extends keyof DataServiceEvents>(
        event: K,
        listener: (data: DataServiceEvents[K]) => void
    ): () => void;
    off<K extends keyof DataServiceEvents>(
        event: K,
        listener: (data: DataServiceEvents[K]) => void
    ): void;

    // Lifecycle
    initialize(): Promise<void>;
    destroy(): void;
}

/**
 * Implementation of centralized data service
 */
export class DataService implements IDataService {
    private readonly dataManager: DataManager;
    private readonly eventListeners = new Map<string, Array<(data: unknown) => void>>();
    private dataSourcesCache: readonly TimeSeriesData[] = [];
    private metadataCache = new Map<string, DataSourceMetadata>();
    private labelsCache = new LRUCache<string, readonly TimeSeriesLabel[]>(50);

    // Memoized methods for performance
    private memoizedGetDataSources: () => Promise<
        Result<readonly TimeSeriesData[], DataValidationError>
    >;

    constructor(dataManager?: DataManager) {
        this.dataManager = dataManager || new UploadDataManager();

        // Initialize memoized methods
        this.memoizedGetDataSources = memoizeAsync(
            () => this.getDataSourcesInternal(),
            { maxSize: 1, ttl: 5000 } // Cache for 5 seconds
        );

        this.setupDataManagerListeners();
    }

    /**
     * Initialize the data service
     */
    async initialize(): Promise<void> {
        // Load initial data sources
        const sourcesResult = await this.getDataSources();
        if (sourcesResult.ok) {
            this.dataSourcesCache = sourcesResult.value;
            this.updateMetadataCache(sourcesResult.value);
        }
    }

    /**
     * Clean up resources and event listeners
     */
    destroy(): void {
        this.eventListeners.clear();
        this.dataSourcesCache = [];
        this.metadataCache.clear();

        if ('destroy' in this.dataManager && typeof this.dataManager.destroy === 'function') {
            (this.dataManager.destroy as () => void)();
        }
    }

    /**
     * Get all data sources with caching
     */
    async getDataSources(): Promise<Result<readonly TimeSeriesData[], DataValidationError>> {
        return this.memoizedGetDataSources();
    }

    /**
     * Internal implementation for data sources retrieval
     */
    private async getDataSourcesInternal(): Promise<
        Result<readonly TimeSeriesData[], DataValidationError>
    > {
        try {
            const result = await this.dataManager.getDataSources();
            if (result.ok) {
                this.dataSourcesCache = result.value;
                this.updateMetadataCache(result.value);
                return ok(result.value);
            }
            return err(new DataValidationError('Failed to load data sources', result.error));
        } catch (error) {
            return err(new DataValidationError('Error loading data sources', error));
        }
    }

    /**
     * Add new data sources from uploaded files
     */
    addDataSource(files: TDataFile[]): Result<readonly TimeSeriesData[], DataValidationError> {
        try {
            // Convert files to time series data
            const newDataSources = convertDataFilesToTimeSeries(files);

            // Update cache
            const updatedSources = [...this.dataSourcesCache, ...newDataSources];
            this.dataSourcesCache = updatedSources;
            this.updateMetadataCache(newDataSources);

            // Emit events
            newDataSources.forEach((source) => {
                this.emit('dataSourceAdded', source);
            });
            this.emit('dataSourcesChanged', updatedSources);

            return ok(updatedSources);
        } catch (error) {
            return err(new DataValidationError('Failed to add data sources', error));
        }
    }

    /**
     * Remove a data source by ID
     */
    removeDataSource(id: string): Result<void, DataValidationError> {
        try {
            // Remove from cache
            this.dataSourcesCache = this.dataSourcesCache.filter((source) => {
                const sourceId =
                    'id' in source && typeof source.id === 'string' ? source.id : undefined;
                return sourceId !== id;
            });

            // Remove metadata
            this.metadataCache.delete(id);

            // Emit events
            this.emit('dataSourceRemoved', id);
            this.emit('dataSourcesChanged', this.dataSourcesCache);

            return ok(undefined);
        } catch (error) {
            return err(new DataValidationError('Failed to remove data source', error));
        }
    }

    /**
     * Get metadata for a specific data source
     */
    getDataSourceMetadata(id: string): Result<DataSourceMetadata | null, DataValidationError> {
        try {
            const metadata = this.metadataCache.get(id) || null;
            return ok(metadata);
        } catch (error) {
            return err(new DataValidationError('Failed to get data source metadata', error));
        }
    }

    /**
     * Refresh data sources from the underlying data manager
     */
    async refreshDataSources(): Promise<Result<readonly TimeSeriesData[], DataValidationError>> {
        return this.getDataSources();
    }

    /**
     * Get labels for a specific data source with caching
     */
    async getLabelsForDataSource(
        dataSourceId: string
    ): Promise<Result<readonly TimeSeriesLabel[], DataValidationError>> {
        try {
            // Check cache first
            const cached = this.labelsCache.get(dataSourceId);
            if (cached) {
                return ok(cached);
            }

            const result = await getAllTimeSeriesLabels();
            if (result.ok) {
                const labels = (result.value as unknown as TimeSeriesLabel[]).filter(
                    (label) => label.datasetId === dataSourceId
                );

                // Cache the result
                this.labelsCache.set(dataSourceId, labels);
                return ok(labels);
            }
            return err(new DataValidationError('Failed to load labels', result.error));
        } catch (error) {
            return err(new DataValidationError('Error loading labels', error));
        }
    }

    /**
     * Add a new label to a data source
     */
    async addLabel(
        dataSourceId: string,
        label: TimeSeriesLabel
    ): Promise<Result<void, DataValidationError>> {
        try {
            const result = await saveTimeSeriesLabel(label as unknown as IDBRecord);
            if (result.ok) {
                // Invalidate cache for this data source
                this.labelsCache.set(dataSourceId, []); // Clear cache entry

                this.emit('labelAdded', label);

                // Get updated labels for the event
                const labelsResult = await this.getLabelsForDataSource(dataSourceId);
                if (labelsResult.ok) {
                    this.emit('labelsChanged', labelsResult.value);
                }

                return ok(undefined);
            }
            return err(new DataValidationError('Failed to save label', result.error));
        } catch (error) {
            return err(new DataValidationError('Error adding label', error));
        }
    }

    /**
     * Remove a label by ID
     */
    async removeLabel(labelId: string): Promise<Result<void, DataValidationError>> {
        try {
            const result = await deleteTimeSeriesLabel(labelId);
            if (result.ok) {
                this.emit('labelRemoved', labelId);

                // Note: We could emit labelsChanged here, but it would require
                // knowing which data source this label belonged to
                return ok(undefined);
            }
            return err(new DataValidationError('Failed to delete label', result.error));
        } catch (error) {
            return err(new DataValidationError('Error removing label', error));
        }
    }

    /**
     * Update an existing label
     */
    async updateLabel(
        labelId: string,
        updates: Partial<TimeSeriesLabel>
    ): Promise<Result<TimeSeriesLabel, DataValidationError>> {
        try {
            // First, get the existing label
            const allLabelsResult = await getAllTimeSeriesLabels();
            if (!allLabelsResult.ok) {
                return err(
                    new DataValidationError(
                        'Failed to load labels for update',
                        allLabelsResult.error
                    )
                );
            }

            const existingLabel = (allLabelsResult.value as unknown as TimeSeriesLabel[]).find(
                (label) => label.id === labelId
            );

            if (!existingLabel) {
                return err(new DataValidationError('Label not found'));
            }

            // Create updated label
            const updatedLabel: TimeSeriesLabel = {
                ...existingLabel,
                ...updates,
                id: labelId, // Ensure ID doesn't change
                updatedAt: Date.now(),
            };

            // Save the updated label
            const saveResult = await saveTimeSeriesLabel(updatedLabel as unknown as IDBRecord);
            if (saveResult.ok) {
                this.emit('labelAdded', updatedLabel); // Using labelAdded for updates too
                return ok(updatedLabel);
            }

            return err(new DataValidationError('Failed to update label', saveResult.error));
        } catch (error) {
            return err(new DataValidationError('Error updating label', error));
        }
    }

    /**
     * Subscribe to data service events
     */
    on<K extends keyof DataServiceEvents>(
        event: K,
        listener: (data: DataServiceEvents[K]) => void
    ): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }

        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.push(listener);
        }

        // Return unsubscribe function
        return () => {
            this.off(event, listener);
        };
    }

    /**
     * Unsubscribe from data service events
     */
    off<K extends keyof DataServiceEvents>(
        event: K,
        listener: (data: DataServiceEvents[K]) => void
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all listeners
     */
    private emit<K extends keyof DataServiceEvents>(event: K, data: DataServiceEvents[K]): void {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach((listener) => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }

    /**
     * Setup listeners for the underlying data manager
     */
    private setupDataManagerListeners(): void {
        if (
            'onDataChanged' in this.dataManager &&
            typeof this.dataManager.onDataChanged === 'function'
        ) {
            this.dataManager.onDataChanged((sources) => {
                this.dataSourcesCache = sources;
                this.updateMetadataCache(sources);
                this.emit('dataSourcesChanged', sources);
            });
        }
    }

    /**
     * Update metadata cache from data sources
     */
    private updateMetadataCache(dataSources: readonly TimeSeriesData[]): void {
        dataSources.forEach((source) => {
            const sourceId =
                'id' in source && typeof source.id === 'string' ? source.id : undefined;
            const sourceName =
                'name' in source && typeof source.name === 'string' ? source.name : 'Unnamed';

            if (sourceId) {
                const metadata: DataSourceMetadata = {
                    id: sourceId,
                    name: sourceName,
                    fileName:
                        'fileName' in source && typeof source.fileName === 'string'
                            ? source.fileName
                            : undefined,
                    size: 'size' in source && typeof source.size === 'number' ? source.size : 0,
                    uploadDate:
                        'uploadDate' in source && typeof source.uploadDate === 'number'
                            ? source.uploadDate
                            : Date.now(),
                    type: this.inferDataType(sourceName),
                    columns:
                        'columns' in source && Array.isArray(source.columns) ? source.columns : [],
                    rowCount:
                        'rowCount' in source && typeof source.rowCount === 'number'
                            ? source.rowCount
                            : 0,
                };

                this.metadataCache.set(sourceId, metadata);
            }
        });
    }

    /**
     * Infer data type from source name/fileName
     */
    private inferDataType(name: string): 'csv' | 'json' | 'other' {
        const lowerName = name.toLowerCase();
        if (lowerName.endsWith('.csv')) return 'csv';
        if (lowerName.endsWith('.json')) return 'json';
        return 'other';
    }
}

// Service registry integration
let dataServiceInstance: DataService | null = null;

/**
 * Get the global data service instance
 */
export function getDataService(): DataService {
    if (!dataServiceInstance) {
        dataServiceInstance = new DataService();
    }
    return dataServiceInstance;
}

/**
 * Factory function for dependency injection
 */
export function createDataService(dataManager?: DataManager): DataService {
    return new DataService(dataManager);
}

/**
 * Reset the global data service (useful for testing)
 */
export function resetDataService(): void {
    if (dataServiceInstance) {
        dataServiceInstance.destroy();
        dataServiceInstance = null;
    }
}
