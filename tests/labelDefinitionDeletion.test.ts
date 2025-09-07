import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
const mockGetAllLabels = vi.fn();
const mockSaveLabel = vi.fn();
const mockDeleteRecord = vi.fn();
const mockGetAllTimeSeriesLabels = vi.fn();
const mockSaveTimeSeriesLabel = vi.fn();
const mockDeleteTimeSeriesLabel = vi.fn();

vi.mock('@/platform/storage', () => ({
    getAllLabels: mockGetAllLabels,
    saveLabel: mockSaveLabel,
    deleteRecord: mockDeleteRecord,
    getAllTimeSeriesLabels: mockGetAllTimeSeriesLabels,
    saveTimeSeriesLabel: mockSaveTimeSeriesLabel,
    deleteTimeSeriesLabel: mockDeleteTimeSeriesLabel,
    STORE_LABELS: 'labels',
    STORE_TIME_SERIES_LABELS: 'timeSeriesLabels',
}));

import { ok } from '@/shared';
import type { LabelDefinition, TimeSeriesLabel } from '@/types/storage';

describe('Label Definition Deletion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        // Set up clean DOM
        document.body.innerHTML = `
            <div class="labels-list"></div>
        `;

        // Start with empty storage
        mockGetAllLabels.mockResolvedValue(ok([]));
        mockSaveLabel.mockResolvedValue(ok(undefined));
        mockDeleteRecord.mockResolvedValue(ok(undefined));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok([]));
        mockSaveTimeSeriesLabel.mockResolvedValue(ok(undefined));
        mockDeleteTimeSeriesLabel.mockResolvedValue(ok(undefined));
    });

    it('should remove all associated labels when label definition is deleted', async () => {
        // This test reproduces the scenario:
        // 1. Create label definition
        // 2. Create some labels using this definition
        // 3. Delete the label definition
        // 4. Verify all associated labels are removed (not just reset)

        // === PHASE 1: Setup label definition ===
        const labelDef: LabelDefinition = {
            id: 'def-market-anomaly',
            name: 'Market Anomaly',
            color: '#e74c3c',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        mockGetAllLabels.mockResolvedValue(ok([labelDef]));

        const { loadLabelDefinitions, deleteLabelDefinition, getLabelDefinitions } = await import(
            '@/ui/dropdowns'
        );

        await loadLabelDefinitions();
        const initialDefs = getLabelDefinitions();
        expect(initialDefs).toHaveLength(1);

        // === PHASE 2: Create time series labels that reference this definition ===
        const labels: TimeSeriesLabel[] = [
            {
                id: 'label-1',
                startTime: 1000,
                endTime: 2000,
                labelDefId: 'def-market-anomaly', // References the definition
                datasetId: 'test-dataset',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
            {
                id: 'label-2',
                startTime: 3000,
                endTime: 4000,
                labelDefId: 'def-market-anomaly', // References the same definition
                datasetId: 'test-dataset',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
            {
                id: 'label-3',
                startTime: 5000,
                endTime: 6000,
                labelDefId: 'other-definition', // References different definition
                datasetId: 'test-dataset',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
        ];

        // Setup storage to return these labels when queried
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok(labels));

        // === PHASE 3: Track event notifications ===
        let labelsChangedEventFired = false;
        window.addEventListener('timelab:timeSeriesLabelsChanged', () => {
            labelsChangedEventFired = true;
        });

        // === PHASE 4: Delete the label definition ===
        deleteLabelDefinition(0); // Delete the first (and only) definition

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        // === PHASE 5: Verify cascading deletion ===

        // 1. Label definition should be deleted from storage
        expect(mockDeleteRecord).toHaveBeenCalledWith('def-market-anomaly', 'labels');

        // 2. Associated time series labels should be deleted
        expect(mockDeleteTimeSeriesLabel).toHaveBeenCalledWith('label-1');
        expect(mockDeleteTimeSeriesLabel).toHaveBeenCalledWith('label-2');

        // 3. Unrelated labels should NOT be deleted
        expect(mockDeleteTimeSeriesLabel).not.toHaveBeenCalledWith('label-3');

        // 4. UI should be notified about the changes
        expect(labelsChangedEventFired).toBe(true);

        // 5. Definition should be removed from in-memory cache
        const remainingDefs = getLabelDefinitions();
        expect(remainingDefs).toHaveLength(0);
    });

    it('should handle the case where no labels reference the deleted definition', async () => {
        // Test edge case: deleting a definition that has no associated labels

        const labelDef: LabelDefinition = {
            id: 'def-unused',
            name: 'Unused Definition',
            color: '#123456',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        mockGetAllLabels.mockResolvedValue(ok([labelDef]));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok([])); // No labels exist

        const { loadLabelDefinitions, deleteLabelDefinition } = await import('@/ui/dropdowns');

        await loadLabelDefinitions();

        // Track event notifications
        let labelsChangedEventFired = false;
        window.addEventListener('timelab:timeSeriesLabelsChanged', () => {
            labelsChangedEventFired = true;
        });

        // Delete the definition
        deleteLabelDefinition(0);

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should still delete the definition
        expect(mockDeleteRecord).toHaveBeenCalledWith('def-unused', 'labels');

        // Should not attempt to delete any time series labels
        expect(mockDeleteTimeSeriesLabel).not.toHaveBeenCalled();

        // Should still notify UI (even though no labels were affected)
        expect(labelsChangedEventFired).toBe(true);
    });
});
