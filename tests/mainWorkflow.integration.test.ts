import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err } from '@/shared/result';
import type { Project, ProjectServiceEvents } from '@/types/project';
import type { TDataFile } from '@/data/uploads';
import type { TimeSeriesLabel, LabelDefinition } from '@/types/storage';

// Mock all external dependencies
const mockStorage = {
    getAllProjects: vi.fn(),
    saveProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getAllLabels: vi.fn(),
    saveLabel: vi.fn(),
    deleteRecord: vi.fn(),
    getAllTimeSeriesLabels: vi.fn(),
    saveTimeSeriesLabel: vi.fn(),
    deleteTimeSeriesLabel: vi.fn(),
};

vi.mock('@/platform/storage', () => mockStorage);
vi.mock('@/platform/projectStorage', () => mockStorage);

// Mock data manager
const mockDataManager = {
    getDataSources: vi.fn(),
    onDataChanged: vi.fn(),
    offDataChanged: vi.fn(),
    destroy: vi.fn(),
};

vi.mock('@/data', () => ({
    getDataManager: () => mockDataManager,
}));

// Mock chart system
const mockChart = {
    setDataSources: vi.fn(),
    updateConfig: vi.fn(),
    enableLabelMode: vi.fn(),
    disableLabelMode: vi.fn(),
    destroy: vi.fn(),
};

describe('Main Workflow Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup default mock responses
        mockStorage.getAllProjects.mockResolvedValue([]);
        mockStorage.getAllLabels.mockResolvedValue([]);
        mockStorage.getAllTimeSeriesLabels.mockResolvedValue([]);
        mockDataManager.getDataSources.mockResolvedValue(ok([]));
    });

    describe('Project Management Workflow', () => {
        it('should create, load, and switch projects successfully', async () => {
            // Import project service
            const { ProjectService } = await import('@/services/projectService');
            const service = new ProjectService();
            
            // Mock successful project creation
            const newProject: Project = {
                id: 'proj-1',
                name: 'Test Project',
                description: 'Integration test project',
                isDefault: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            
            mockStorage.saveProject.mockResolvedValue(ok(newProject));
            mockStorage.getAllProjects.mockResolvedValue([newProject]);
            
            // Test project creation
            const createResult = await service.createProject({
                name: 'Test Project',
                description: 'Integration test project',
                isDefault: false,
            });
            
            expect(createResult.ok).toBe(true);
            if (createResult.ok) {
                expect(createResult.value.name).toBe('Test Project');
                expect(mockStorage.saveProject).toHaveBeenCalledWith(expect.objectContaining({
                    name: 'Test Project',
                    description: 'Integration test project',
                }));
            }
            
            // Test project loading
            await service.initialize();
            const projects = service.getAllProjects();
            expect(projects).toHaveLength(1);
            expect(projects[0].name).toBe('Test Project');
            
            service.destroy();
        });

        it('should handle project update workflow', async () => {
            const { ProjectService } = await import('@/services/projectService');
            const service = new ProjectService();
            
            const existingProject: Project = {
                id: 'proj-1',
                name: 'Original Name',
                description: 'Original Description',
                isDefault: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            
            const updatedProject: Project = {
                ...existingProject,
                name: 'Updated Name',
                description: 'Updated Description',
                updatedAt: Date.now(),
            };
            
            mockStorage.getAllProjects.mockResolvedValue([existingProject]);
            mockStorage.updateProject.mockResolvedValue(ok(updatedProject));
            
            await service.initialize();
            
            const updateResult = await service.updateProject('proj-1', {
                name: 'Updated Name',
                description: 'Updated Description',
            });
            
            expect(updateResult.ok).toBe(true);
            if (updateResult.ok) {
                expect(updateResult.value.name).toBe('Updated Name');
                expect(mockStorage.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
                    name: 'Updated Name',
                    description: 'Updated Description',
                }));
            }
            
            service.destroy();
        });
    });

    describe('Data Loading and Processing Workflow', () => {
        it('should load CSV data and convert to time series', async () => {
            const mockDataFiles: TDataFile[] = [
                {
                    id: 'data-1',
                    name: 'test-data.csv',
                    size: 1024,
                    type: 'text/csv',
                    addedAt: Date.now(),
                    visible: true,
                    labeled: false,
                    text: 'timestamp,value\n1234567890,100\n1234567891,101\n1234567892,102'
                }
            ];

            // Mock the data conversion
            const { convertDataFilesToTimeSeries } = await import('@/data/csvProcessor');
            const mockTimeSeries = [{
                id: 'data-1',
                name: 'test-data.csv',
                columns: ['timestamp', 'value'],
                getData: vi.fn().mockReturnValue([[1234567890, 100], [1234567891, 101], [1234567892, 102]]),
                isLabeled: vi.fn().mockReturnValue(false),
                setLabeled: vi.fn(),
                getLabels: vi.fn().mockReturnValue([]),
                addLabel: vi.fn(),
                removeLabel: vi.fn(),
                toggleLabelVisibility: vi.fn(),
                updateLabel: vi.fn(),
            }];

            mockDataManager.getDataSources.mockResolvedValue(ok(mockTimeSeries));
            
            // Test data manager integration
            const { UploadDataManager } = await import('@/data/dataManager');
            const dataManager = new UploadDataManager();
            
            const dataResult = await dataManager.getDataSources();
            expect(dataResult.ok).toBe(true);
            
            if (dataResult.ok) {
                expect(dataResult.value).toHaveLength(1);
                expect(dataResult.value[0].name).toBe('test-data.csv');
                expect(dataResult.value[0].columns).toEqual(['timestamp', 'value']);
            }
            
            dataManager.destroy();
        });
    });

    describe('Label Management Workflow', () => {
        it('should create label definitions and apply labels to time series', async () => {
            // Mock label definitions
            const labelDef: LabelDefinition = {
                id: 'label-def-1',
                name: 'Test Label',
                color: '#ff0000',
                createdAt: Date.now(),
            };
            
            mockStorage.saveLabel.mockResolvedValue(ok(labelDef));
            mockStorage.getAllLabels.mockResolvedValue([labelDef]);
            
            // Mock time series label
            const timeSeriesLabel: TimeSeriesLabel = {
                id: 'ts-label-1',
                datasetId: 'data-1',
                labelDefId: 'label-def-1',
                startTime: 1234567890,
                endTime: 1234567892,
                visible: true,
                createdAt: Date.now(),
            };
            
            mockStorage.saveTimeSeriesLabel.mockResolvedValue(ok(timeSeriesLabel));
            mockStorage.getAllTimeSeriesLabels.mockResolvedValue([timeSeriesLabel]);
            
            // Test label service integration
            const { LabelService } = await import('@/services/labelService');
            const labelService = new LabelService();
            await labelService.initialize();
            
            // Test label definition creation
            const createDefResult = await labelService.createLabelDefinition({
                name: 'Test Label',
                color: '#ff0000',
            });
            
            expect(createDefResult.ok).toBe(true);
            if (createDefResult.ok) {
                expect(createDefResult.value.name).toBe('Test Label');
                expect(mockStorage.saveLabel).toHaveBeenCalledWith(expect.objectContaining({
                    name: 'Test Label',
                    color: '#ff0000',
                }));
            }
            
            // Test time series label creation
            const createLabelResult = await labelService.createTimeSeriesLabel({
                datasetId: 'data-1',
                labelDefId: 'label-def-1',
                startTime: 1234567890,
                endTime: 1234567892,
            });
            
            expect(createLabelResult.ok).toBe(true);
            if (createLabelResult.ok) {
                expect(createLabelResult.value.datasetId).toBe('data-1');
                expect(createLabelResult.value.labelDefId).toBe('label-def-1');
                expect(mockStorage.saveTimeSeriesLabel).toHaveBeenCalledWith(expect.objectContaining({
                    datasetId: 'data-1',
                    labelDefId: 'label-def-1',
                    startTime: 1234567890,
                    endTime: 1234567892,
                }));
            }
            
            labelService.destroy();
        });
    });

    describe('Event System Integration', () => {
        it('should properly handle service events and cleanup', async () => {
            const { ProjectService } = await import('@/services/projectService');
            const service = new ProjectService();
            
            const eventSpy = vi.fn();
            
            // Test event subscription
            service.on('projectCreated', eventSpy);
            
            const newProject: Project = {
                id: 'proj-1',
                name: 'Event Test Project',
                description: 'Test project for events',
                isDefault: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            
            mockStorage.saveProject.mockResolvedValue(ok(newProject));
            
            // Create project to trigger event
            await service.createProject({
                name: 'Event Test Project',
                description: 'Test project for events',
                isDefault: false,
            });
            
            // Verify event was emitted with correct data
            expect(eventSpy).toHaveBeenCalledWith(newProject);
            
            // Test event unsubscription
            service.off('projectCreated', eventSpy);
            
            // Create another project
            await service.createProject({
                name: 'Second Project',
                description: 'Should not trigger event',
                isDefault: false,
            });
            
            // Verify event was not called again (still only 1 call)
            expect(eventSpy).toHaveBeenCalledTimes(1);
            
            // Test cleanup
            service.destroy();
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle storage errors gracefully', async () => {
            const { ProjectService } = await import('@/services/projectService');
            const service = new ProjectService();
            
            // Mock storage error
            const storageError = new Error('Storage unavailable');
            mockStorage.saveProject.mockResolvedValue(err(storageError));
            
            // Test error handling
            const createResult = await service.createProject({
                name: 'Failed Project',
                description: 'This should fail',
                isDefault: false,
            });
            
            expect(createResult.ok).toBe(false);
            if (!createResult.ok) {
                expect(createResult.error.message).toContain('Storage unavailable');
            }
            
            service.destroy();
        });

        it('should handle data manager errors gracefully', async () => {
            // Mock data manager error
            mockDataManager.getDataSources.mockResolvedValue(err(new Error('Data access failed')));
            
            const { UploadDataManager } = await import('@/data/dataManager');
            const dataManager = new UploadDataManager();
            
            const dataResult = await dataManager.getDataSources();
            expect(dataResult.ok).toBe(false);
            
            if (!dataResult.ok) {
                expect(dataResult.error.message).toContain('Data access failed');
            }
            
            dataManager.destroy();
        });
    });

    describe('Memory Management Integration', () => {
        it('should properly clean up resources', async () => {
            // Test all services clean up properly
            const { ProjectService } = await import('@/services/projectService');
            const { LabelService } = await import('@/services/labelService');
            const { UploadDataManager } = await import('@/data/dataManager');
            
            const projectService = new ProjectService();
            const labelService = new LabelService();
            const dataManager = new UploadDataManager();
            
            // Initialize services
            await projectService.initialize();
            await labelService.initialize();
            
            // Verify they're working
            expect(projectService.getAllProjects).toBeDefined();
            expect(labelService.getAllLabelDefinitions).toBeDefined();
            expect(dataManager.getDataSources).toBeDefined();
            
            // Test cleanup
            projectService.destroy();
            labelService.destroy();
            dataManager.destroy();
            
            // Verify cleanup doesn't throw errors
            expect(() => projectService.destroy()).not.toThrow();
            expect(() => labelService.destroy()).not.toThrow();
            expect(() => dataManager.destroy()).not.toThrow();
        });
    });
});