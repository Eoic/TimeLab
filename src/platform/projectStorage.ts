/**
 * Project storage operations using IndexedDB
 */

import type { Result } from '../shared';
import { ok, err, StorageError } from '../shared';
import { uuid } from '../shared/misc';
import type { Project, CreateProjectParams, UpdateProjectParams } from '../types/project';

// Storage constants
const CURRENT_PROJECT_KEY = 'currentProjectId';

/**
 * Initialize project storage
 */
export async function initializeProjectStorage(): Promise<Result<void, StorageError>> {
    try {
        // Storage initialization happens in main storage module
        // This just validates that the project store exists
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to initialize project storage'));
    }
}

/**
 * Get all projects from storage
 */
export async function getAllProjects(): Promise<Result<Project[], StorageError>> {
    try {
        const { getAllRecords, STORE_PROJECTS } = await import('./storage');
        const result = await getAllRecords<Project>(STORE_PROJECTS);

        if (result.ok) {
            return ok(result.value);
        }
        return err(result.error);
    } catch (error) {
        return err(new StorageError('Failed to load projects'));
    }
}

/**
 * Get a specific project by ID
 */
export async function getProject(id: string): Promise<Result<Project | null, StorageError>> {
    try {
        const { getRecord, STORE_PROJECTS } = await import('./storage');
        const result = await getRecord<Project>(id, STORE_PROJECTS);

        if (result.ok) {
            return ok(result.value);
        }
        return err(result.error);
    } catch (error) {
        return err(new StorageError('Failed to load project'));
    }
}

/**
 * Create a new project
 */
export async function createProject(
    params: CreateProjectParams
): Promise<Result<Project, StorageError>> {
    try {
        const project: Project = {
            id: uuid(),
            name: params.name,
            description: params.description || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDefault: params.isDefault || false,
        };

        const { saveRecord, STORE_PROJECTS } = await import('./storage');
        const result = await saveRecord(project, STORE_PROJECTS);

        if (result.ok) {
            return ok(project);
        }
        return err(result.error);
    } catch (error) {
        return err(new StorageError('Failed to create project'));
    }
}

/**
 * Update an existing project
 */
export async function updateProject(
    id: string,
    params: UpdateProjectParams
): Promise<Result<Project, StorageError>> {
    try {
        // Get existing project
        const existingResult = await getProject(id);
        if (!existingResult.ok) {
            return err(existingResult.error);
        }

        const existing = existingResult.value;
        if (!existing) {
            return err(new StorageError('Project not found'));
        }

        // Update project
        const updated: Project = {
            ...existing,
            ...params,
            updatedAt: Date.now(),
        };

        const { saveRecord, STORE_PROJECTS } = await import('./storage');
        const result = await saveRecord(updated, STORE_PROJECTS);

        if (result.ok) {
            return ok(updated);
        }
        return err(result.error);
    } catch (error) {
        return err(new StorageError('Failed to update project'));
    }
}

/**
 * Delete a project and all its data
 */
export async function deleteProject(id: string): Promise<Result<void, StorageError>> {
    try {
        const { deleteRecord, STORE_PROJECTS } = await import('./storage');

        // Delete the project record
        const result = await deleteRecord(id, STORE_PROJECTS);
        if (!result.ok) {
            return err(result.error);
        }

        // TODO: Delete all project-scoped data (labels, time series, etc.)
        // This will be implemented when we add project scoping to existing data

        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to delete project'));
    }
}

/**
 * Get the current active project ID
 */
export async function getCurrentProjectId(): Promise<Result<string | null, StorageError>> {
    try {
        const stored = localStorage.getItem(CURRENT_PROJECT_KEY);
        return ok(stored);
    } catch (error) {
        return err(new StorageError('Failed to get current project ID'));
    }
}

/**
 * Set the current active project ID
 */
export async function setCurrentProjectId(projectId: string): Promise<Result<void, StorageError>> {
    try {
        localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to set current project ID'));
    }
}

/**
 * Clear the current project ID
 */
export async function clearCurrentProjectId(): Promise<Result<void, StorageError>> {
    try {
        localStorage.removeItem(CURRENT_PROJECT_KEY);
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to clear current project ID'));
    }
}

/**
 * Create the default "Untitled" project
 */
export async function createDefaultProject(): Promise<Result<Project, StorageError>> {
    return createProject({
        name: 'Untitled',
        description: 'Default project',
        isDefault: true,
    });
}
