/**
 * Service for managing label definitions and time series labels
 * Handles persistence to IndexedDB and provides reactive updates
 */

import { DEFAULT_LABEL_DEFINITIONS, createLabelDefinition } from '../domain/labels';
import type { LabelDefinition, TimeSeriesLabel } from '../domain/labels';
import { getAllRecords, saveRecord, deleteRecord, STORE_LABELS, getAllTimeSeriesLabels, deleteTimeSeriesLabel } from '../platform/storage';
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
     * Update an existing label definition and cascade changes to related labels
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
                        // Cascade the changes to related TimeSeriesLabels
            await this.cascadeDefinitionUpdate();
            this.notifyListeners();
            return ok(updated);
        }
        return err(new StorageError('Failed to update label definition'));
    }

    /**
     * Delete a label definition and cascade deletion to related labels
     */
    async deleteLabelDefinition(id: string): Promise<Result<void, StorageError>> {
        // First cascade deletion to all related TimeSeriesLabels
        await this.cascadeDefinitionDeletion(id);
        
        const result = await deleteRecord(id, STORE_LABELS);
        if (result.ok) {
            this.labelDefinitions.delete(id);
            this.notifyListeners();
        }
        return result;
    }

    /**
     * Cascade label definition changes to UI components
     * Since TimeSeriesLabels reference LabelDefinitions by ID,
     * they automatically reflect changes when the UI refreshes
     */
    private async cascadeDefinitionUpdate(): Promise<void> {
        try {
            // Just notify UI components to refresh - labels automatically
            // show updated name/color since they reference definitions by ID
            this.notifyTimeSeriesLabelsChanged();
        } catch (error) {
            console.error('Error during label definition cascade update:', error);
        }
    }    /**
     * Cascade label definition deletion to all related TimeSeriesLabels
     */
    private async cascadeDefinitionDeletion(defId: string): Promise<void> {
        try {
            // Get all TimeSeriesLabels from storage that reference this definition
            const allLabelsResult = await getAllTimeSeriesLabels<any>();
            if (!allLabelsResult.ok) {
                console.error('Failed to load labels for cascade deletion');
                return;
            }

            const labelsToDelete = allLabelsResult.value.filter(
                (label: any) => label.labelDefId === defId
            );

            // Delete all related labels in parallel for better performance
            const deletePromises = labelsToDelete.map(async (label: any) => {
                try {
                    await deleteTimeSeriesLabel(label.id);
                    // Also remove from in-memory storage
                    this.removeLabelFromAllDatasets(label.id);
                } catch (error) {
                    console.error('Failed to delete label during cascade:', error);
                }
            });

            // Wait for all deletions to complete
            await Promise.all(deletePromises);

            // Notify UI components about the changes
            this.notifyTimeSeriesLabelsChanged();
        } catch (error) {
            console.error('Error during label definition cascade deletion:', error);
        }
    }

    /**
     * Remove a label from all datasets (helper for cascade operations)
     */
    private removeLabelFromAllDatasets(labelId: string): void {
        for (const [, labels] of Array.from(this.timeSeriesLabels.entries())) {
            const index = labels.findIndex((l) => l.id === labelId);
            if (index >= 0) {
                labels.splice(index, 1);
            }
        }
    }

    /**
     * Notify about TimeSeriesLabels changes (for UI refresh)
     */
    private notifyTimeSeriesLabelsChanged(): void {
        // Dispatch a custom event that UI components can listen to
        window.dispatchEvent(new CustomEvent('timelab:timeSeriesLabelsChanged'));
    }
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
