import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ok } from '@/shared';
import { uuid } from '@/shared/misc';
import type { LabelDefinition, TimeSeriesLabel } from '@/types/storage';

// Mock the storage functions
vi.mock('@/platform/storage', () => ({
    getAllLabels: vi.fn(),
    saveLabel: vi.fn(),
    getAllTimeSeriesLabels: vi.fn(),
    saveTimeSeriesLabel: vi.fn(),
}));

// Mock CSV processor to test label integration
vi.mock('@/data/csvProcessor', async () => {
    const actual = await vi.importActual('@/data/csvProcessor');
    return {
        ...actual,
    };
});

describe('Time Series Label Creation and Usage', () => {
    let mockLabelDefinitions: LabelDefinition[];

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mock label definitions
        mockLabelDefinitions = [
            {
                id: 'def-1',
                name: 'Anomaly',
                color: '#ff0000',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 'def-2',
                name: 'Normal',
                color: '#00ff00',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ];

        // Mock storage to return our test definitions
        const { getAllLabels, saveLabel } = await import('@/platform/storage');
        vi.mocked(getAllLabels).mockResolvedValue(ok(mockLabelDefinitions));
        vi.mocked(saveLabel).mockResolvedValue(ok(undefined));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should create a time series label with correct properties', async () => {
        // Arrange: Load label definitions first
        const { loadLabelDefinitions } = await import('@/ui/dropdowns');
        await loadLabelDefinitions();

        // Create a mock CSV data source
        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');
        const csvData = new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: false,
            text: 'timestamp,value\n1,10\n2,20\n3,30',
        });

        // Act: Create a time series label
        const labelId = uuid();
        const timeSeriesLabel: TimeSeriesLabel = {
            id: labelId,
            startTime: 1,
            endTime: 2,
            labelDefId: 'def-1', // Reference to 'Anomaly' definition
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            visible: true,
        };

        csvData.addLabel(timeSeriesLabel);

        // Assert: Label should be added to the dataset
        const labels = csvData.getLabels();
        expect(labels).toHaveLength(1);
        expect(labels[0]).toEqual(
            expect.objectContaining({
                id: labelId,
                startTime: 1,
                endTime: 2,
                labelDefId: 'def-1',
                datasetId: 'test-dataset',
                visible: true,
            })
        );
    });

    it('should resolve label definition names and colors correctly', async () => {
        // Arrange: Load label definitions
        const { loadLabelDefinitions, getLabelDefinitions } = await import('@/ui/dropdowns');
        await loadLabelDefinitions();

        const definitions = getLabelDefinitions();
        const anomalyDef = definitions.find((d) => d.name === 'Anomaly');
        const normalDef = definitions.find((d) => d.name === 'Normal');

        expect(anomalyDef).toBeDefined();
        expect(normalDef).toBeDefined();

        // Act & Assert: Should be able to reference definitions by ID
        expect(anomalyDef?.id).toBe('def-1');
        expect(anomalyDef?.color).toBe('#ff0000');
        expect(normalDef?.id).toBe('def-2');
        expect(normalDef?.color).toBe('#00ff00');
    });

    it('should toggle label visibility correctly', async () => {
        // Arrange: Setup CSV data with a label
        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');
        const csvData = new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: false,
            text: 'timestamp,value\n1,10\n2,20\n3,30',
        });

        const labelId = uuid();
        const timeSeriesLabel: TimeSeriesLabel = {
            id: labelId,
            startTime: 1,
            endTime: 2,
            labelDefId: 'def-1',
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            visible: true,
        };

        csvData.addLabel(timeSeriesLabel);

        // Act: Toggle visibility
        csvData.toggleLabelVisibility(labelId);

        // Assert: Label should be hidden
        const labels = csvData.getLabels();
        expect(labels[0]?.visible).toBe(false);

        // Act: Toggle again
        csvData.toggleLabelVisibility(labelId);

        // Assert: Label should be visible again
        const updatedLabels = csvData.getLabels();
        expect(updatedLabels[0]?.visible).toBe(true);
    });

    it('should delete labels correctly', async () => {
        // Arrange: Setup CSV data with multiple labels
        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');
        const csvData = new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: false,
            text: 'timestamp,value\n1,10\n2,20\n3,30',
        });

        const label1Id = uuid();
        const label2Id = uuid();

        const label1: TimeSeriesLabel = {
            id: label1Id,
            startTime: 1,
            endTime: 2,
            labelDefId: 'def-1',
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const label2: TimeSeriesLabel = {
            id: label2Id,
            startTime: 3,
            endTime: 4,
            labelDefId: 'def-2',
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        csvData.addLabel(label1);
        csvData.addLabel(label2);

        // Verify setup
        expect(csvData.getLabels()).toHaveLength(2);

        // Act: Delete first label
        csvData.removeLabel(label1Id);

        // Assert: Only second label should remain
        const remainingLabels = csvData.getLabels();
        expect(remainingLabels).toHaveLength(1);
        expect(remainingLabels[0]?.id).toBe(label2Id);
    });

    it('should handle labels with legacy format IDs', async () => {
        // Arrange: Create a label with legacy format ID
        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');
        const csvData = new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: false,
            text: 'timestamp,value\n1,10\n2,20\n3,30',
        });

        // Act: Create label with legacy format
        const legacyLabel: TimeSeriesLabel = {
            id: uuid(),
            startTime: 1,
            endTime: 2,
            labelDefId: 'label-0', // Legacy format: label-{index}
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        csvData.addLabel(legacyLabel);

        // Assert: Label should be added successfully
        const labels = csvData.getLabels();
        expect(labels).toHaveLength(1);
        expect(labels[0]?.labelDefId).toBe('label-0');
    });

    it('should notify when labels change', async () => {
        // Arrange: Setup event listener
        const eventSpy = vi.fn();
        window.addEventListener('timelab:labelsChanged', eventSpy);

        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');
        const csvData = new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: false,
            text: 'timestamp,value\n1,10\n2,20\n3,30',
        });

        // Act: Add a label
        const timeSeriesLabel: TimeSeriesLabel = {
            id: uuid(),
            startTime: 1,
            endTime: 2,
            labelDefId: 'def-1',
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        csvData.addLabel(timeSeriesLabel);

        // Assert: Event should be fired
        expect(eventSpy).toHaveBeenCalled();

        // Cleanup
        window.removeEventListener('timelab:labelsChanged', eventSpy);
    });
});
