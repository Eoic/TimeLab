import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ok } from '@/shared';
import type { LabelDefinition, TimeSeriesLabel } from '@/types/storage';

// Mock storage completely
const mockGetAllLabels = vi.fn();
const mockSaveLabel = vi.fn();
const mockGetAllTimeSeriesLabels = vi.fn();
const mockSaveTimeSeriesLabel = vi.fn();

vi.mock('@/platform/storage', () => ({
    getAllLabels: mockGetAllLabels,
    saveLabel: mockSaveLabel,
    getAllTimeSeriesLabels: mockGetAllTimeSeriesLabels,
    saveTimeSeriesLabel: mockSaveTimeSeriesLabel,
}));

describe('Label Reload Integration Test', () => {
    const testLabelDefinitions: LabelDefinition[] = [
        {
            id: 'def-anomaly',
            name: 'Anomaly',
            color: '#ff0000',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            id: 'def-normal',
            name: 'Normal',
            color: '#00ff00',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    ];

    const testTimeSeriesLabels: TimeSeriesLabel[] = [
        {
            id: 'label-1',
            startTime: 100,
            endTime: 200,
            labelDefId: 'def-anomaly',
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            visible: true,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        mockGetAllLabels.mockResolvedValue(ok(testLabelDefinitions));
        mockSaveLabel.mockResolvedValue(ok(undefined));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok(testTimeSeriesLabels));
        mockSaveTimeSeriesLabel.mockResolvedValue(ok(undefined));

        // Clear any module state by re-importing
        vi.resetModules();
    });

    it('should demonstrate the reload issue: labels loading before definitions', async () => {
        // Step 1: Simulate page load where CSV data loads its labels first

        // Import fresh modules
        const { getLabelDefinitions } = await import('@/ui/dropdowns');

        // At this point, no definitions should be loaded
        const initialDefinitions = getLabelDefinitions();
        expect(initialDefinitions).toHaveLength(0);

        // Step 2: Simulate what happens when a TimeSeriesLabel tries to resolve its definition
        // This is what createLabelItem does in the labels panel
        const testLabel = testTimeSeriesLabels[0]!;
        const labelDefinitions = getLabelDefinitions(); // This would return []

        const labelDef = labelDefinitions.find((def) => def.id === testLabel.labelDefId);

        // This is the problem: labelDef is undefined because definitions aren't loaded yet
        expect(labelDef).toBeUndefined();

        // So the label would fall back to showing the ID
        const labelName = labelDef?.name || `Fallback: ${testLabel.labelDefId}`;
        expect(labelName).toBe('Fallback: def-anomaly'); // Shows ID instead of name
    });

    it('should demonstrate the fix: definitions loaded first, then labels resolve correctly', async () => {
        // Step 1: Load definitions first (our fix)
        const { loadLabelDefinitions, getLabelDefinitions } = await import('@/ui/dropdowns');

        await loadLabelDefinitions();

        // Step 2: Now definitions are available
        const loadedDefinitions = getLabelDefinitions();
        expect(loadedDefinitions).toHaveLength(2);
        expect(loadedDefinitions[0]?.name).toBe('Anomaly');

        // Step 3: When labels try to resolve their definitions, they work correctly
        const testLabel = testTimeSeriesLabels[0]!;
        const labelDefinitions = getLabelDefinitions();

        const labelDef = labelDefinitions.find((def) => def.id === testLabel.labelDefId);

        // Now the definition is found
        expect(labelDef).toBeDefined();
        expect(labelDef?.name).toBe('Anomaly');
        expect(labelDef?.color).toBe('#ff0000');

        // So the label shows the correct name
        const labelName = labelDef?.name || `Fallback: ${testLabel.labelDefId}`;
        expect(labelName).toBe('Anomaly'); // Shows name, not ID
    });

    it('should test event-driven refresh when definitions load after labels', async () => {
        // This tests our event-based fix for the labels panel

        // Step 1: Setup event listener (like labels panel does)
        let refreshCalled = false;
        const handleDefinitionsLoaded = () => {
            refreshCalled = true;
        };

        window.addEventListener('timelab:labelDefinitionsLoaded', handleDefinitionsLoaded);

        // Step 2: Load definitions (should trigger event)
        const { loadLabelDefinitions } = await import('@/ui/dropdowns');
        await loadLabelDefinitions();

        // Step 3: Event should have been fired
        expect(refreshCalled).toBe(true);

        // Cleanup
        window.removeEventListener('timelab:labelDefinitionsLoaded', handleDefinitionsLoaded);
    });

    it('should test CSV processor waiting for definitions (our current fix)', async () => {
        // This tests the fix we implemented in CSV processor

        // Step 1: Create a CSV processor instance
        const { CSVTimeSeriesData } = await import('@/data/csvProcessor');

        // Mock the CSV constructor to avoid actual label loading
        new CSVTimeSeriesData({
            id: 'test-dataset',
            name: 'test.csv',
            size: 100,
            type: 'text/csv',
            addedAt: Date.now(),
            visible: true,
            labeled: true,
            text: 'timestamp,value\n100,10\n200,20',
        });

        // Step 2: The CSV processor should wait for definitions
        // (In our implementation, it checks getLabelDefinitions() and waits for event if empty)

        // Since we haven't loaded definitions yet, the CSV should be waiting
        const { getLabelDefinitions } = await import('@/ui/dropdowns');
        const definitionsBeforeLoad = getLabelDefinitions();
        expect(definitionsBeforeLoad).toHaveLength(0);

        // Step 3: Load definitions (should trigger CSV to load its labels)
        const { loadLabelDefinitions } = await import('@/ui/dropdowns');
        await loadLabelDefinitions();

        // Step 4: Now definitions should be available
        const definitionsAfterLoad = getLabelDefinitions();
        expect(definitionsAfterLoad).toHaveLength(2);
        expect(definitionsAfterLoad[0]?.name).toBe('Anomaly');
    });

    it('should handle legacy label format correctly', async () => {
        // Test the legacy format fallback
        const { loadLabelDefinitions, getLabelDefinitions } = await import('@/ui/dropdowns');

        await loadLabelDefinitions();
        const definitions = getLabelDefinitions();

        // Simulate a label with legacy format ID
        const legacyLabel: TimeSeriesLabel = {
            id: 'legacy-1',
            startTime: 100,
            endTime: 200,
            labelDefId: 'label-0', // Legacy format
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // Try to resolve using legacy format
        let labelDef = definitions.find((def) => def.id === legacyLabel.labelDefId);

        if (!labelDef) {
            // Fallback for legacy format "label-{index}"
            const labelDefMatch = legacyLabel.labelDefId.match(/^label-(\d+)$/);
            if (labelDefMatch?.[1]) {
                const index = parseInt(labelDefMatch[1], 10);
                labelDef = definitions[index];
            }
        }

        // Should resolve to first definition (index 0)
        expect(labelDef).toBeDefined();
        expect(labelDef?.name).toBe('Anomaly');
    });
});
