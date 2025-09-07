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

// Mock data manager with spy-able data sources
const mockDataSources = {
    source1: {
        id: 'test-dataset-1',
        removeLabel: vi.fn(),
        getLabels: vi.fn().mockReturnValue([]),
    },
    source2: {
        id: 'test-dataset-2',
        removeLabel: vi.fn(),
        getLabels: vi.fn().mockReturnValue([]),
    },
};

const mockDataManager = {
    getDataSources: vi.fn().mockResolvedValue([mockDataSources.source1, mockDataSources.source2]),
    onDataChanged: vi.fn(),
    offDataChanged: vi.fn(),
};

vi.mock('@/data', () => ({
    getDataManager: () => mockDataManager,
}));

import { ok } from '@/shared';
import type { LabelDefinition, TimeSeriesLabel } from '@/types/storage';

describe('Label Definition Deletion - Data Source Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        // Reset mock data sources
        mockDataSources.source1.removeLabel.mockClear();
        mockDataSources.source2.removeLabel.mockClear();

        // Set up clean DOM
        document.body.innerHTML = `<div class="labels-list"></div>`;

        // Start with empty storage
        mockGetAllLabels.mockResolvedValue(ok([]));
        mockSaveLabel.mockResolvedValue(ok(undefined));
        mockDeleteRecord.mockResolvedValue(ok(undefined));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok([]));
        mockSaveTimeSeriesLabel.mockResolvedValue(ok(undefined));
        mockDeleteTimeSeriesLabel.mockResolvedValue(ok(undefined));
    });

    it('should call removeLabel on all data sources when label definition is deleted', async () => {
        // === PHASE 1: Setup label definition ===
        const labelDef: LabelDefinition = {
            id: 'def-market-anomaly',
            name: 'Market Anomaly',
            color: '#e74c3c',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        mockGetAllLabels.mockResolvedValue(ok([labelDef]));

        // === PHASE 2: Setup time series labels that reference this definition ===
        const labels: TimeSeriesLabel[] = [
            {
                id: 'label-1',
                startTime: 1000,
                endTime: 2000,
                labelDefId: 'def-market-anomaly',
                datasetId: 'test-dataset-1', // Belongs to source1
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
            {
                id: 'label-2',
                startTime: 3000,
                endTime: 4000,
                labelDefId: 'def-market-anomaly',
                datasetId: 'test-dataset-2', // Belongs to source2
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
            {
                id: 'label-3',
                startTime: 5000,
                endTime: 6000,
                labelDefId: 'other-definition', // Different definition - should not be deleted
                datasetId: 'test-dataset-1',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
        ];

        mockGetAllTimeSeriesLabels.mockResolvedValue(ok(labels));

        // === PHASE 3: Load and delete the label definition ===
        const { loadLabelDefinitions, deleteLabelDefinition } = await import('@/ui/dropdowns');

        await loadLabelDefinitions();

        // Delete the label definition (triggers cascade)
        deleteLabelDefinition(0);

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // === PHASE 4: Verify that data sources were called ===

        // 1. Data manager should have been queried for data sources
        expect(mockDataManager.getDataSources).toHaveBeenCalled();

        // 2. removeLabel should be called on both data sources for the affected labels
        expect(mockDataSources.source1.removeLabel).toHaveBeenCalledWith('label-1');
        expect(mockDataSources.source2.removeLabel).toHaveBeenCalledWith('label-2');

        // 3. removeLabel should NOT be called for the unrelated label
        expect(mockDataSources.source1.removeLabel).not.toHaveBeenCalledWith('label-3');
        expect(mockDataSources.source2.removeLabel).not.toHaveBeenCalledWith('label-3');

        // 4. Storage deletion should still happen
        expect(mockDeleteTimeSeriesLabel).toHaveBeenCalledWith('label-1');
        expect(mockDeleteTimeSeriesLabel).toHaveBeenCalledWith('label-2');
        expect(mockDeleteTimeSeriesLabel).not.toHaveBeenCalledWith('label-3');

        // 5. Definition should be deleted from storage
        expect(mockDeleteRecord).toHaveBeenCalledWith('def-market-anomaly', 'labels');
    });

    it('should handle gracefully when data sources do not support removeLabel', async () => {
        // Test with a data source that doesn't have removeLabel method

        const dataSourceWithoutRemoveLabel = {
            id: 'legacy-source',
            getLabels: vi.fn().mockReturnValue([]),
            // No removeLabel method
        };

        mockDataManager.getDataSources.mockResolvedValue([dataSourceWithoutRemoveLabel]);

        const labelDef: LabelDefinition = {
            id: 'def-test',
            name: 'Test Definition',
            color: '#123456',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const labels: TimeSeriesLabel[] = [
            {
                id: 'label-legacy',
                startTime: 1000,
                endTime: 2000,
                labelDefId: 'def-test',
                datasetId: 'legacy-source',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                visible: true,
            },
        ];

        mockGetAllLabels.mockResolvedValue(ok([labelDef]));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok(labels));

        const { loadLabelDefinitions, deleteLabelDefinition } = await import('@/ui/dropdowns');

        await loadLabelDefinitions();

        // This should not throw an error even though the data source lacks removeLabel
        expect(() => {
            deleteLabelDefinition(0);
        }).not.toThrow();

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Storage operations should still complete successfully
        expect(mockDeleteTimeSeriesLabel).toHaveBeenCalledWith('label-legacy');
        expect(mockDeleteRecord).toHaveBeenCalledWith('def-test', 'labels');
    });
});
