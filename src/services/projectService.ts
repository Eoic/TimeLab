/**
 * Project service for managing project operations and state
 */

import type { IProjectStorage } from '../platform/projectStorage';
import * as defaultStorage from '../platform/projectStorage';
import type { Result } from '../shared';
import { ok, err, StorageError } from '../shared';
import type {
    Project,
    CreateProjectParams,
    UpdateProjectParams,
    ProjectSwitchContext,
    IProjectService,
    ProjectServiceEvents,
} from '../types/project';

type EventListenerMap = {
    [K in keyof ProjectServiceEvents]: Array<(data: ProjectServiceEvents[K]) => void>;
};

export class ProjectService implements IProjectService {
    private currentProject: Project | null = null;
    private projects: Project[] = [];
    private eventListeners: Partial<EventListenerMap> = {};
    private readonly storage: IProjectStorage;

    constructor(storage?: IProjectStorage) {
        this.storage = storage || defaultStorage;
        this.initializeEventMap();
    }

    private initializeEventMap(): void {
        this.eventListeners.projectCreated = [];
        this.eventListeners.projectUpdated = [];
        this.eventListeners.projectDeleted = [];
        this.eventListeners.projectSwitched = [];
        this.eventListeners.projectsLoaded = [];
    }

    /**
     * Clean up resources and event listeners to prevent memory leaks
     */
    destroy(): void {
        this.eventListeners = {};
        this.currentProject = null;
        this.projects = [];
    }

    private emit<K extends keyof ProjectServiceEvents>(
        event: K,
        data: ProjectServiceEvents[K]
    ): void {
        const listeners = this.eventListeners[event] || [];
        listeners.forEach((listener) => {
            listener(data);
        });
    }

    on<K extends keyof ProjectServiceEvents>(
        event: K,
        listener: (data: ProjectServiceEvents[K]) => void
    ): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event]!.push(listener);
    }

    off<K extends keyof ProjectServiceEvents>(
        event: K,
        listener: (data: ProjectServiceEvents[K]) => void
    ): void {
        const listeners = this.eventListeners[event];
        if (!listeners) return;

        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    async initialize(): Promise<void> {
        try {
            // Initialize storage
            const storageResult = await this.storage.initializeProjectStorage();
            if (!storageResult.ok) {
                throw new Error(`Storage initialization failed: ${storageResult.error.message}`);
            }

            // Load all projects
            const projectsResult = await this.loadProjects();
            if (!projectsResult.ok) {
                throw new Error(`Projects loading failed: ${projectsResult.error.message}`);
            }

            // Load current project
            const currentIdResult = await this.storage.getCurrentProjectId();
            if (currentIdResult.ok && currentIdResult.value) {
                const currentProjectResult = await this.storage.getProject(currentIdResult.value);
                if (currentProjectResult.ok && currentProjectResult.value) {
                    this.currentProject = currentProjectResult.value;
                }
            }

            // If no current project, create or use default
            if (!this.currentProject) {
                await this.ensureDefaultProject();
            }
        } catch (error) {
            throw new Error(
                `Project service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async ensureDefaultProject(): Promise<void> {
        // Look for existing default project
        const defaultProject = this.projects.find((p) => p.isDefault);

        if (defaultProject) {
            this.currentProject = defaultProject;
            await this.storage.setCurrentProjectId(defaultProject.id);
        } else {
            // Create default project
            const result = await this.storage.createDefaultProject();
            if (result.ok) {
                this.currentProject = result.value;
                this.projects.push(result.value);
                await this.storage.setCurrentProjectId(result.value.id);
            }
        }
    }

    async loadProjects(): Promise<Result<Project[], StorageError>> {
        const result = await this.storage.getAllProjects();
        if (result.ok) {
            this.projects = result.value;
            this.emit('projectsLoaded', this.projects);
            return ok(this.projects);
        }
        return err(result.error);
    }

    getCurrentProject(): Project | null {
        return this.currentProject;
    }

    getAllProjects(): Project[] {
        return [...this.projects];
    }

    async createProject(params: CreateProjectParams): Promise<Result<Project, StorageError>> {
        const result = await this.storage.createProject(params);
        if (result.ok) {
            this.projects.push(result.value);
            this.emit('projectCreated', result.value);
            return ok(result.value);
        }
        return err(result.error);
    }

    async updateProject(
        id: string,
        params: UpdateProjectParams
    ): Promise<Result<Project, StorageError>> {
        const result = await this.storage.updateProject(id, params);
        if (result.ok) {
            // Update in local array
            const index = this.projects.findIndex((p) => p.id === id);
            if (index >= 0) {
                this.projects[index] = result.value;
            }

            // Update current project if it's the one being updated
            if (this.currentProject?.id === id) {
                this.currentProject = result.value;
            }

            this.emit('projectUpdated', result.value);
            return ok(result.value);
        }
        return err(result.error);
    }

    async deleteProject(id: string): Promise<Result<void, StorageError>> {
        const result = await this.storage.deleteProject(id);
        if (result.ok) {
            // Remove from local array
            this.projects = this.projects.filter((p) => p.id !== id);

            // If we deleted the current project or this was the last project, handle switching
            const wasCurrentProject = this.currentProject?.id === id;

            if (this.projects.length === 0) {
                // Create a new default project if no projects remain
                const createResult = await this.createProject({
                    name: 'Untitled',
                    isDefault: true,
                });
                if (createResult.ok) {
                    await this.switchToProject(createResult.value.id);
                } else {
                    this.currentProject = null;
                    await this.storage.clearCurrentProjectId();
                }
            } else if (wasCurrentProject) {
                // Switch to the first available project
                const firstProject = this.projects[0];
                if (firstProject) {
                    await this.switchToProject(firstProject.id);
                }
            }

            this.emit('projectDeleted', { id });
            return ok(undefined);
        }
        return err(result.error);
    }

    async switchToProject(projectId: string): Promise<Result<ProjectSwitchContext, StorageError>> {
        const project = this.projects.find((p) => p.id === projectId);
        if (!project) {
            return err(new StorageError('Project not found'));
        }

        const previousProject = this.currentProject;
        this.currentProject = project;

        const result = await this.storage.setCurrentProjectId(projectId);
        if (result.ok) {
            const context: ProjectSwitchContext = {
                previousProject,
                currentProject: project,
                timestamp: Date.now(),
            };

            this.emit('projectSwitched', context);
            return ok(context);
        }

        // Revert on error
        this.currentProject = previousProject;
        return err(result.error);
    }

    async renameProject(id: string, newName: string): Promise<Result<Project, StorageError>> {
        return this.updateProject(id, { name: newName });
    }

    getProjectById(id: string): Project | null {
        return this.projects.find((p) => p.id === id) || null;
    }
}

// Legacy singleton export - use service registry instead
// This is kept for backward compatibility but should be avoided
export const projectService = new ProjectService();

// Factory function for service registry
export function createProjectService(storage?: IProjectStorage): ProjectService {
    return new ProjectService(storage);
}
