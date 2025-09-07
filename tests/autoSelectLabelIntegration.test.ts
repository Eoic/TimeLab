import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
const mockGetAllLabels = vi.fn();
const mockSaveLabel = vi.fn();

vi.mock('@/platform/storage', () => ({
    getAllLabels: mockGetAllLabels,
    saveLabel: mockSaveLabel,
}));

import { ok } from '@/shared';

describe('Auto-select Label Definition Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Set up DOM with active label dropdown
        document.body.innerHTML = `
            <tl-dropdown id="active-label"></tl-dropdown>
        `;

        // Mock TLDropdown behavior
        const dropdown = document.querySelector('#active-label');
        if (dropdown) {
            let currentValue = '';
            let currentOptions: any[] = [];

            Object.defineProperty(dropdown, 'value', {
                get: () => currentValue,
                set: (value: string) => {
                    currentValue = value;
                },
                configurable: true,
            });

            Object.defineProperty(dropdown, 'options', {
                get: () => currentOptions,
                set: (options: any[]) => {
                    currentOptions = options;
                },
                configurable: true,
            });
        }

        // Start with empty storage
        mockGetAllLabels.mockResolvedValue(ok([]));
        mockSaveLabel.mockResolvedValue(ok(undefined));
    });

    it('should demonstrate complete user workflow with auto-selection', async () => {
        // This test simulates the complete user experience:
        // 1. User creates first label definition
        // 2. It gets auto-selected
        // 3. User creates second label definition
        // 4. The newest one gets auto-selected
        // 5. User can still manually change selection

        const { addLabelDefinition, getLabelDefinitions } = await import('@/ui/dropdowns');
        const dropdown = document.querySelector('#active-label');

        // === STEP 1: User creates first label definition ===
        console.log('Creating first label definition...');
        addLabelDefinition('Anomaly', '#ff0000');

        const firstDefs = getLabelDefinitions();
        expect(firstDefs).toHaveLength(1);
        expect(firstDefs[0]?.name).toBe('Anomaly');

        // First definition should be auto-selected
        expect(dropdown.value).toBe(firstDefs[0]?.id);
        console.log('✅ First definition auto-selected:', dropdown.value);

        // === STEP 2: User creates second label definition ===
        console.log('Creating second label definition...');
        addLabelDefinition('Normal', '#00ff00');

        const secondDefs = getLabelDefinitions();
        expect(secondDefs).toHaveLength(2);
        expect(secondDefs[1]?.name).toBe('Normal');

        // Second (newest) definition should now be auto-selected
        expect(dropdown.value).toBe(secondDefs[1]?.id);
        expect(dropdown.value).not.toBe(firstDefs[0]?.id); // Not the first anymore
        console.log('✅ Second definition auto-selected:', dropdown.value);

        // === STEP 3: User creates third label definition ===
        console.log('Creating third label definition...');
        addLabelDefinition('Trend', '#0000ff');

        const thirdDefs = getLabelDefinitions();
        expect(thirdDefs).toHaveLength(3);
        expect(thirdDefs[2]?.name).toBe('Trend');

        // Third (newest) definition should now be auto-selected
        expect(dropdown.value).toBe(thirdDefs[2]?.id);
        console.log('✅ Third definition auto-selected:', dropdown.value);

        // === STEP 4: Verify user can still manually change selection ===
        console.log('Manually changing selection...');
        dropdown.value = firstDefs[0]?.id; // User manually selects first definition
        expect(dropdown.value).toBe(firstDefs[0]?.id);
        console.log('✅ Manual selection works:', dropdown.value);

        // === STEP 5: Create one more to verify it still auto-selects ===
        console.log('Creating fourth label definition after manual change...');
        addLabelDefinition('Pattern', '#ffff00');

        const fourthDefs = getLabelDefinitions();
        expect(fourthDefs).toHaveLength(4);
        expect(fourthDefs[3]?.name).toBe('Pattern');

        // Fourth definition should be auto-selected, overriding manual selection
        expect(dropdown.value).toBe(fourthDefs[3]?.id);
        console.log('✅ Fourth definition auto-selected, overriding manual selection');

        console.log('🎉 Complete workflow test passed!');
    });
});
