/**
 * Tests for project management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProjectService } from '../src/services/projectService';

// Mock storage for testing
vi.mock('../src/platform/projectStorage', () => ({
    initializeProjectStorage: vi.fn().mockResolvedValue({ ok: true }),
    getAllProjects: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getCurrentProjectId: vi.fn().mockResolvedValue({ ok: true, value: null }),
    createDefaultProject: vi.fn().mockResolvedValue({
        ok: true,
        value: {
            id: 'default-id',
            name: 'Untitled',
            description: 'Default project',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDefault: true,
        },
    }),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    setCurrentProjectId: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('ProjectService', () => {
    let projectService: ProjectService;

    beforeEach(() => {
        projectService = new ProjectService();
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await expect(projectService.initialize()).resolves.not.toThrow();
        });

        it('should create default project if none exists', async () => {
            await projectService.initialize();

            const currentProject = projectService.getCurrentProject();
            expect(currentProject).toBeTruthy();
            expect(currentProject?.name).toBe('Untitled');
            expect(currentProject?.isDefault).toBe(true);
        });
    });

    describe('project management', () => {
        beforeEach(async () => {
            await projectService.initialize();
        });

        it('should get current project', () => {
            const currentProject = projectService.getCurrentProject();
            expect(currentProject).toBeTruthy();
        });

        it('should get all projects', () => {
            const projects = projectService.getAllProjects();
            expect(Array.isArray(projects)).toBe(true);
        });

        it('should get project by ID', async () => {
            const currentProject = projectService.getCurrentProject();
            if (currentProject) {
                const foundProject = projectService.getProjectById(currentProject.id);
                expect(foundProject).toEqual(currentProject);
            }
        });

        it('should return null for non-existent project ID', () => {
            const foundProject = projectService.getProjectById('non-existent');
            expect(foundProject).toBeNull();
        });
    });

    describe('event system', () => {
        beforeEach(async () => {
            await projectService.initialize();
        });

        it('should allow event subscription and unsubscription', () => {
            const mockListener = vi.fn();

            // Subscribe
            projectService.on('projectCreated', mockListener);

            // Unsubscribe
            projectService.off('projectCreated', mockListener);

            // This should not throw
            expect(true).toBe(true);
        });
    });
});
