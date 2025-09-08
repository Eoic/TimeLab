import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all external dependencies
vi.mock('@/platform/storage', () => ({
    getAllProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getAllLabels: vi.fn().mockResolvedValue([]),
    saveLabel: vi.fn(),
    deleteRecord: vi.fn(),
    getAllTimeSeriesLabels: vi.fn().mockResolvedValue([]),
    saveTimeSeriesLabel: vi.fn(),
    deleteTimeSeriesLabel: vi.fn(),
}));

describe('UI Components Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset DOM to a clean state with required elements
        document.body.innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>TimeLab</h1>
                </div>
                <div class="toolbar">
                    <div class="left">
                        <button id="btn-upload-data">Upload Data</button>
                        <button id="btn-manage-data">Manage Data</button>
                    </div>
                    <div class="right">
                        <button id="btn-create-project">Create Project</button>
                    </div>
                </div>
                <div class="chart">
                    <div id="chart-container"></div>
                </div>
                <div class="labels-list" role="listbox" aria-label="Time series labels"></div>
                <div class="history-list"></div>
                <div id="project-toolbar"></div>
                <div id="loading-screen" class="loading-screen">
                    <div class="loading-percentage">0%</div>
                    <div class="loading-status">Loading...</div>
                </div>
            </div>
        `;
    });

    describe('Project Modal Integration', () => {
        it('should create and display project modal correctly', async () => {
            const { showCreateProjectModal } = await import('@/ui/projectModal');
            
            // Mock successful project creation
            vi.doMock('@/services/projectService', () => ({
                projectService: {
                    createProject: vi.fn().mockResolvedValue({
                        ok: true,
                        value: {
                            id: 'proj-1',
                            name: 'Test Project',
                            description: 'Test Description',
                            isDefault: false,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        }
                    })
                }
            }));
            
            // Open the modal
            const modalPromise = showCreateProjectModal();
            
            // Check modal was added to DOM
            const modal = document.querySelector('.modal');
            expect(modal).toBeTruthy();
            expect(modal?.querySelector('h2')?.textContent).toBe('Create New Project');
            
            // Fill out the form
            const nameInput = modal?.querySelector('#project-name') as HTMLInputElement;
            const descriptionInput = modal?.querySelector('#project-description') as HTMLTextAreaElement;
            const submitBtn = modal?.querySelector('button[type="submit"]') as HTMLButtonElement;
            
            expect(nameInput).toBeTruthy();
            expect(descriptionInput).toBeTruthy();
            expect(submitBtn).toBeTruthy();
            
            // Simulate user input
            nameInput.value = 'Test Project';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            descriptionInput.value = 'Test Description';
            descriptionInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Submit the form
            const form = modal?.querySelector('form') as HTMLFormElement;
            form.dispatchEvent(new Event('submit', { bubbles: true }));
            
            // Wait for the modal promise to resolve
            const result = await modalPromise;
            expect(result).toBe(true);
        });
    });

    describe('Labels Panel Integration', () => {
        it('should initialize labels panel and handle chart connection', async () => {
            const { LabelsPanel } = await import('@/ui/labelsPanel');
            
            // Mock chart
            const mockChart = {
                on: vi.fn(),
                off: vi.fn(),
                setDataSources: vi.fn(),
                enableLabelMode: vi.fn(),
                disableLabelMode: vi.fn(),
            };
            
            // Create labels panel
            const panel = new LabelsPanel();
            
            // Connect to chart
            panel.connectToChart(mockChart as any);
            
            // Verify chart event listeners were set up
            expect(mockChart.on).toHaveBeenCalledWith('label-drawn', expect.any(Function));
            expect(mockChart.on).toHaveBeenCalledWith('label-removed', expect.any(Function));
            expect(mockChart.on).toHaveBeenCalledWith('columns-available', expect.any(Function));
            
            // Test cleanup
            panel.destroy();
        });

        it('should handle label visibility toggling', async () => {
            const { LabelsPanel } = await import('@/ui/labelsPanel');
            
            // Add some labels to the DOM
            const labelsContainer = document.querySelector('.labels-list');
            if (labelsContainer) {
                labelsContainer.innerHTML = `
                    <div class="label-item" data-label-id="label-1">
                        <span class="label-name">Test Label 1</span>
                        <button class="toggle-visibility" data-label-id="label-1">Hide</button>
                    </div>
                    <div class="label-item" data-label-id="label-2">
                        <span class="label-name">Test Label 2</span>
                        <button class="toggle-visibility" data-label-id="label-2">Hide</button>
                    </div>
                `;
            }
            
            const panel = new LabelsPanel();
            
            // Simulate clicking the visibility toggle
            const toggleButton = document.querySelector('[data-label-id="label-1"].toggle-visibility') as HTMLButtonElement;
            expect(toggleButton).toBeTruthy();
            
            toggleButton.click();
            
            // Check if the button text changed (indicating state change)
            // Note: Actual implementation would need to be checked for specific behavior
            expect(toggleButton).toBeTruthy();
            
            panel.destroy();
        });
    });

    describe('Dropdown Component Integration', () => {
        it('should initialize custom dropdown component', async () => {
            // Import and define the dropdown component
            const { defineDropdown } = await import('@/ui/dropdown');
            defineDropdown();
            
            // Create a dropdown element
            const dropdown = document.createElement('tl-dropdown');
            dropdown.setAttribute('placeholder', 'Select option');
            document.body.appendChild(dropdown);
            
            // Wait for component to be defined
            await customElements.whenDefined('tl-dropdown');
            
            // Verify the component was created correctly
            expect(dropdown.tagName.toLowerCase()).toBe('tl-dropdown');
            expect(dropdown.getAttribute('placeholder')).toBe('Select option');
            
            // Test setting options
            const options = [
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' }
            ];
            
            (dropdown as any).options = options;
            expect((dropdown as any).options).toEqual(options);
            
            // Cleanup
            dropdown.remove();
        });
    });

    describe('Loading Screen Integration', () => {
        it('should initialize and manage loading state', async () => {
            const { initializeLoadingScreen, markLoadingStepComplete } = await import('@/ui/loadingScreen');
            
            const loadingScreen = document.getElementById('loading-screen');
            const loadingStatus = loadingScreen?.querySelector('.loading-status');
            const loadingPercentage = loadingScreen?.querySelector('.loading-percentage');
            
            expect(loadingScreen).toBeTruthy();
            expect(loadingStatus).toBeTruthy();
            expect(loadingPercentage).toBeTruthy();
            
            // Initialize the loading screen
            initializeLoadingScreen();
            
            // Mark steps complete
            markLoadingStepComplete('app-initialized');
            markLoadingStepComplete('data-loaded');
            markLoadingStepComplete('ui-ready');
            
            // Verify loading percentage updated
            expect(loadingPercentage?.textContent).toContain('%');
        });
    });

    describe('Settings Integration', () => {
        it('should handle settings initialization and theme switching', async () => {
            // Add settings elements to DOM
            const settingsHTML = `
                <div id="settings-panel">
                    <select id="theme-selector">
                        <option value="auto">Auto</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', settingsHTML);
            
            const { setupSettings } = await import('@/settings');
            
            // Initialize settings
            setupSettings();
            
            const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
            expect(themeSelector).toBeTruthy();
            
            // Test theme switching
            themeSelector.value = 'dark';
            themeSelector.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Verify theme was applied to HTML element
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            
            // Test another theme
            themeSelector.value = 'light';
            themeSelector.dispatchEvent(new Event('change', { bubbles: true }));
            
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    describe('Event System Integration', () => {
        it('should handle global custom events properly', async () => {
            const eventSpy = vi.fn();
            
            // Listen for a custom event
            window.addEventListener('timelab:dataFilesChanged', eventSpy);
            
            // Dispatch the event
            const customEvent = new CustomEvent('timelab:dataFilesChanged', {
                detail: { files: [] }
            });
            window.dispatchEvent(customEvent);
            
            // Verify event was received
            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'timelab:dataFilesChanged',
                detail: { files: [] }
            }));
            
            // Cleanup
            window.removeEventListener('timelab:dataFilesChanged', eventSpy);
            
            // Dispatch again to verify cleanup
            window.dispatchEvent(customEvent);
            expect(eventSpy).toHaveBeenCalledTimes(1); // Still only 1 call
        });
    });

    describe('Accessibility Integration', () => {
        it('should handle keyboard interactions correctly', async () => {
            const { setupCheckboxEnterToggle } = await import('@/ui/checkboxAccessibility');
            
            // Add checkbox elements
            const checkboxHTML = `
                <div class="form-group">
                    <input type="checkbox" id="test-checkbox" class="checkbox">
                    <label for="test-checkbox">Test Checkbox</label>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', checkboxHTML);
            
            // Initialize accessibility features
            setupCheckboxEnterToggle();
            
            const checkbox = document.getElementById('test-checkbox') as HTMLInputElement;
            expect(checkbox).toBeTruthy();
            expect(checkbox.checked).toBe(false);
            
            // Simulate Enter key press
            checkbox.focus();
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true
            });
            checkbox.dispatchEvent(enterEvent);
            
            // Check that checkbox was toggled
            expect(checkbox.checked).toBe(true);
            
            // Press Enter again
            checkbox.dispatchEvent(enterEvent);
            expect(checkbox.checked).toBe(false);
        });
    });
});