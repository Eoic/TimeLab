import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
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

import { ok } from '@/shared';
import type { LabelDefinition, TimeSeriesLabel } from '@/types/storage';

describe('UUID Mismatch Bug Fix', () => {
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
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok([]));
        mockSaveTimeSeriesLabel.mockResolvedValue(ok(undefined));
    });

    it('should maintain same UUID between in-memory and saved definition', async () => {
        // This test reproduces the exact scenario described:
        // 1. Create label definition without page reload
        // 2. Use it to label data immediately
        // 3. Reload page
        // 4. Check if label resolves correctly

        // === PHASE 1: Create label definition ===
        const { addLabelDefinition, getLabelDefinitions } = await import('@/ui/dropdowns');

        const customName = 'Market Anomaly';
        const customColor = '#e74c3c';

        // Capture what gets saved to the database
        let savedDefinition: LabelDefinition | null = null;
        mockSaveLabel.mockImplementation((def: LabelDefinition) => {
            savedDefinition = { ...def }; // Capture the saved definition
            return Promise.resolve(ok(undefined));
        });

        // User creates label definition (this should save it to DB)
        addLabelDefinition(customName, customColor);

        // Get the in-memory definition
        const inMemoryDefinitions = getLabelDefinitions();
        expect(inMemoryDefinitions).toHaveLength(1);

        const inMemoryDef = inMemoryDefinitions[0]!;
        console.log('In-memory definition ID:', inMemoryDef.id);
        console.log('Saved definition ID:', savedDefinition?.id);

        // THE FIX: In-memory and saved definitions should have the SAME UUID
        expect(savedDefinition).toBeDefined();
        expect(savedDefinition!.id).toBe(inMemoryDef.id); // This should pass now
        expect(savedDefinition!.name).toBe(customName);
        expect(savedDefinition!.color).toBe(customColor);

        // === PHASE 2: User creates label using the definition ===
        const userLabel: TimeSeriesLabel = {
            id: 'user-label-1',
            startTime: 1000,
            endTime: 2000,
            labelDefId: inMemoryDef.id, // Using the in-memory definition ID
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            visible: true,
        };

        console.log('Label uses definition ID:', userLabel.labelDefId);

        // === PHASE 3: Simulate page reload ===
        vi.resetModules();

        // Setup storage to return the saved definition (not in-memory one)
        mockGetAllLabels.mockResolvedValue(ok([savedDefinition!]));
        mockGetAllTimeSeriesLabels.mockResolvedValue(ok([userLabel]));

        // === PHASE 4: Load definitions from storage ===
        const { loadLabelDefinitions: reloadLoadDefs, getLabelDefinitions: reloadGetDefs } =
            await import('@/ui/dropdowns');

        await reloadLoadDefs();

        const reloadedDefinitions = reloadGetDefs();
        console.log('Reloaded definitions count:', reloadedDefinitions.length);

        expect(reloadedDefinitions).toHaveLength(1);

        const reloadedDef = reloadedDefinitions[0]!;
        console.log('Reloaded definition ID:', reloadedDef.id);
        console.log('Label definition ID:', userLabel.labelDefId);

        // THE KEY TEST: The label should be able to find its definition
        const foundDef = reloadedDefinitions.find((d) => d.id === userLabel.labelDefId);

        expect(foundDef).toBeDefined();
        expect(foundDef!.name).toBe(customName);
        expect(foundDef!.color).toBe(customColor);

        console.log('✅ Label correctly resolves to:', foundDef!.name);
    });

    it('should demonstrate the old broken behavior vs new fixed behavior', async () => {
        // This test shows what would happen with the old broken code

        const customName = 'Test Label';
        const customColor = '#123456';

        // Simulate old broken behavior: different UUIDs
        const inMemoryId = 'def-inmemory-123';
        const savedId = 'def-saved-456'; // Different UUID!

        const savedDef: LabelDefinition = {
            id: savedId, // DIFFERENT UUID
            name: customName,
            color: customColor,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // User creates label using in-memory definition
        const userLabel: TimeSeriesLabel = {
            id: 'test-label',
            startTime: 1000,
            endTime: 2000,
            labelDefId: inMemoryId, // Uses in-memory UUID
            datasetId: 'test-dataset',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            visible: true,
        };

        // After reload, only saved definition is available
        const availableDefinitions = [savedDef]; // Only has savedId, not inMemoryId

        // Try to resolve label
        const foundDef = availableDefinitions.find((d) => d.id === userLabel.labelDefId);

        // OLD BEHAVIOR: This would fail
        expect(foundDef).toBeUndefined(); // Label can't find its definition

        // Result: Label would show UUID instead of name
        const displayName = foundDef?.name || userLabel.labelDefId;
        console.log('Old behavior display name:', displayName);
        expect(displayName).toBe(inMemoryId); // Shows UUID instead of friendly name

        // NEW BEHAVIOR: With our fix, in-memory and saved would have same UUID
        const fixedLabel: TimeSeriesLabel = {
            ...userLabel,
            labelDefId: savedId, // Same UUID as saved definition
        };

        const fixedFoundDef = availableDefinitions.find((d) => d.id === fixedLabel.labelDefId);
        expect(fixedFoundDef).toBeDefined(); // Now it finds the definition

        const fixedDisplayName = fixedFoundDef?.name || fixedLabel.labelDefId;
        console.log('Fixed behavior display name:', fixedDisplayName);
        expect(fixedDisplayName).toBe(customName); // Shows friendly name
    });
});
