/**
 * Service for managing label definitions and time series labels
 * Handles persistence to IndexedDB and provides reactive updates
 */

import { DEFAULT_LABEL_DEFINITIONS, createLabelDefinition } from '../domain/labels';
import type { LabelDefinition, TimeSeriesLabel } from '../domain/labels';
import { getAllRecords, saveRecord, deleteRecord, STORE_LABELS } from '../platform/storage';
import type { Result } from '../shared';
import { StorageError, ok, err } from '../shared';
import type { LabelDefinition as StoredLabelDefinition } from '../types/storage';

/**
 * Service for managing label definitions and operations
 */
export class LabelService {
    private labelDefinitions: Map<string, LabelDefinition> = new Map();
    private timeSeriesLabels: Map<string, TimeSeriesLabel[]> = new Map(); // datasetId -> labels
    private listeners: Array<(defs: readonly LabelDefinition[]) => void> = [];

    constructor() {
        this.initialize();
    }

    /**
     * Initialize the service by loading existing data
     */
    private async initialize(): Promise<void> {
        try {
            await this.loadLabelDefinitions();
            await this.ensureDefaultDefinitions();
        } catch (error) {
            console.error('Failed to initialize label service:', error);
        }
    }

    /**
     * Load label definitions from storage
     */
    private async loadLabelDefinitions(): Promise<void> {
        const result = await getAllRecords<StoredLabelDefinition>(STORE_LABELS);
        if (result.ok) {
            this.labelDefinitions.clear();
            for (const def of result.value) {
                this.labelDefinitions.set(def.id, def);
            }
        }
    }

    /**
     * Ensure default label definitions exist
     */
    private async ensureDefaultDefinitions(): Promise<void> {
        if (this.labelDefinitions.size === 0) {
            for (const defaultDef of DEFAULT_LABEL_DEFINITIONS) {
                await this.saveLabelDefinition(defaultDef);
            }
        }
    }

    /**
     * Get all label definitions
     */
    getLabelDefinitions(): readonly LabelDefinition[] {
        return Array.from(this.labelDefinitions.values());
    }

    /**
     * Get a specific label definition by ID
     */
    getLabelDefinition(id: string): LabelDefinition | undefined {
        return this.labelDefinitions.get(id);
    }

    /**
     * Create and save a new label definition
     */
    async createLabelDefinition(
        name: string,
        color: string
    ): Promise<Result<LabelDefinition, StorageError>> {
        try {
            const definition = createLabelDefinition(name, color);
            const result = await this.saveLabelDefinition(definition);
            if (result.ok) {
                this.notifyListeners();
                return ok(definition);
            }
            return result;
        } catch (error) {
            return err(new StorageError('Failed to create label definition', error));
        }
    }

    /**
     * Update an existing label definition
     */
    async updateLabelDefinition(
        id: string,
        updates: Partial<Omit<LabelDefinition, 'id' | 'createdAt'>>
    ): Promise<Result<LabelDefinition, StorageError>> {
        const existing = this.labelDefinitions.get(id);
        if (!existing) {
            return err(new StorageError('Label definition not found'));
        }

        const updated: LabelDefinition = {
            ...existing,
            ...updates,
            id,
            updatedAt: Date.now(),
        };

        const result = await this.saveLabelDefinition(updated);
        if (result.ok) {
            this.notifyListeners();
            return ok(updated);
        }
        return err(new StorageError('Failed to update label definition', result.error));
    }

    /**
     * Delete a label definition
     */
    async deleteLabelDefinition(id: string): Promise<Result<void, StorageError>> {
        const result = await deleteRecord(id, STORE_LABELS);
        if (result.ok) {
            this.labelDefinitions.delete(id);
            this.notifyListeners();
        }
        return result;
    }

    /**
     * Save a label definition to storage
     */
    private async saveLabelDefinition(
        definition: LabelDefinition
    ): Promise<Result<void, StorageError>> {
        // Create IDBRecord-compatible object
        const storedDef = {
            ...definition,
            // Ensure all properties are stored as unknown for IDBRecord compatibility
        } as StoredLabelDefinition;

        const result = await saveRecord(storedDef, STORE_LABELS);
        if (result.ok) {
            this.labelDefinitions.set(definition.id, definition);
        }
        return result;
    }

    /**
     * Subscribe to label definition changes
     */
    onDefinitionsChanged(listener: (defs: readonly LabelDefinition[]) => void): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners of changes
     */
    private notifyListeners(): void {
        const definitions = this.getLabelDefinitions();
        this.listeners.forEach((listener) => {
            listener(definitions);
        });
    }

    /**
     * Get labels for a specific dataset
     */
    getLabelsForDataset(datasetId: string): readonly TimeSeriesLabel[] {
        return this.timeSeriesLabels.get(datasetId) || [];
    }

    /**
     * Add a label to a dataset
     */
    addLabelToDataset(datasetId: string, label: TimeSeriesLabel): void {
        if (!this.timeSeriesLabels.has(datasetId)) {
            this.timeSeriesLabels.set(datasetId, []);
        }
        this.timeSeriesLabels.get(datasetId)!.push(label);
        // TODO: Persist to IndexedDB when we add a labels store
    }

    /**
     * Remove a label from a dataset
     */
    removeLabelFromDataset(datasetId: string, labelId: string): void {
        const labels = this.timeSeriesLabels.get(datasetId);
        if (labels) {
            const index = labels.findIndex((l) => l.id === labelId);
            if (index >= 0) {
                labels.splice(index, 1);
                // TODO: Persist to IndexedDB
            }
        }
    }
}

// Global instance
let labelServiceInstance: LabelService | null = null;

/**
 * Get the global label service instance
 */
export function getLabelService(): LabelService {
    if (!labelServiceInstance) {
        labelServiceInstance = new LabelService();
    }
    return labelServiceInstance;
}
