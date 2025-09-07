import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock TLDropdown interface for testing
interface MockTLDropdown extends Element {
    value: string;
    options: unknown[];
}

// Helper function to get typed dropdown
function getDropdown(): MockTLDropdown {
    const dropdown = document.querySelector('#active-label') as MockTLDropdown;
    if (!dropdown) {
        throw new Error('Dropdown not found');
    }
    return dropdown;
}

import { ok } from '@/shared';
import type { LabelDefinition } from '@/types/storage';

// Mock storage
const mockGetAllLabels = vi.fn();
const mockSaveLabel = vi.fn();

vi.mock('@/platform/storage', () => ({
    getAllLabels: mockGetAllLabels,
    saveLabel: mockSaveLabel,
}));

describe('Auto-select New Label Definition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        // Set up clean DOM with active label dropdown
        document.body.innerHTML = `
            <div class="labels-list"></div>
            <tl-dropdown id="active-label"></tl-dropdown>
        `;

        // Mock the TLDropdown element
        const dropdown = getDropdown();
        // Mock properties for testing
        dropdown.options = [];
        Object.defineProperty(dropdown, 'value', {
            value: '',
            writable: true,
            configurable: true,
        });

        // Start with empty storage
        mockGetAllLabels.mockResolvedValue(ok([]));
        mockSaveLabel.mockResolvedValue(ok(undefined));
    });

    it('should auto-select newly created label definition as active', async () => {
        // === PHASE 1: Initial state - no definitions ===
        const { addLabelDefinition, getLabelDefinitions } = await import('@/ui/dropdowns');

        const initialDefinitions = getLabelDefinitions();
        expect(initialDefinitions).toHaveLength(0);

        const dropdown = getDropdown();
        expect(dropdown.value).toBe('');

        // === PHASE 2: Create first label definition ===
        const firstName = 'Market Anomaly';
        const firstColor = '#e74c3c';

        addLabelDefinition(firstName, firstColor);

        // === PHASE 3: Verify auto-selection ===
        const definitionsAfterFirst = getLabelDefinitions();
        expect(definitionsAfterFirst).toHaveLength(1);

        const firstDefinition = definitionsAfterFirst[0]!;
        expect(firstDefinition.name).toBe(firstName);
        expect(firstDefinition.color).toBe(firstColor);

        // The newly created definition should be automatically selected
        expect(dropdown.value).toBe(firstDefinition.id);

        // === PHASE 4: Create second label definition ===
        const secondName = 'Normal Behavior';
        const secondColor = '#2ecc71';

        addLabelDefinition(secondName, secondColor);

        // === PHASE 5: Verify new definition is auto-selected ===
        const definitionsAfterSecond = getLabelDefinitions();
        expect(definitionsAfterSecond).toHaveLength(2);

        const secondDefinition = definitionsAfterSecond[1]!;
        expect(secondDefinition.name).toBe(secondName);
        expect(secondDefinition.color).toBe(secondColor);

        // The second (newly created) definition should now be selected
        expect(dropdown.value).toBe(secondDefinition.id);

        // Verify it's not the first definition anymore
        expect(dropdown.value).not.toBe(firstDefinition.id);
    });

    it('should handle the case when dropdown element is not found', async () => {
        // Remove the dropdown from DOM
        const dropdown = document.querySelector('#active-label');
        dropdown?.remove();

        const { addLabelDefinition } = await import('@/ui/dropdowns');

        // This should not throw an error even without dropdown
        expect(() => {
            addLabelDefinition('Test Label', '#123456');
        }).not.toThrow();
    });

    it('should work with existing definitions', async () => {
        // === PHASE 1: Setup existing definitions ===
        const existingDefinitions: LabelDefinition[] = [
            {
                id: 'existing-1',
                name: 'Existing Label 1',
                color: '#111111',
                createdAt: Date.now() - 1000,
                updatedAt: Date.now() - 1000,
            },
            {
                id: 'existing-2',
                name: 'Existing Label 2',
                color: '#222222',
                createdAt: Date.now() - 500,
                updatedAt: Date.now() - 500,
            },
        ];

        mockGetAllLabels.mockResolvedValue(ok(existingDefinitions));

        const { loadLabelDefinitions, addLabelDefinition } = await import('@/ui/dropdowns');

        // Load existing definitions
        await loadLabelDefinitions();

        const dropdown = getDropdown();

        // Manually set dropdown to existing value
        dropdown.value = 'existing-1';
        expect(dropdown.value).toBe('existing-1');

        // === PHASE 2: Add new definition ===
        addLabelDefinition('New Label', '#333333');

        // === PHASE 3: Verify new definition is auto-selected ===
        const { getLabelDefinitions } = await import('@/ui/dropdowns');
        const allDefinitions = getLabelDefinitions();

        expect(allDefinitions).toHaveLength(3);

        const newDefinition = allDefinitions[2]!; // Should be the last one added
        expect(newDefinition.name).toBe('New Label');

        // The new definition should be selected, overriding the previous selection
        expect(dropdown.value).toBe(newDefinition.id);
    });
});
