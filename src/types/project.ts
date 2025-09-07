/**
 * Project management types and interfaces
 */

import type { IDBRecord } from '../platform/storage';
import type { Result, StorageError } from '../shared';

/**
 * Core project interface
 */
export interface Project extends IDBRecord {
    /** Unique project identifier */
    id: string;
    /** Project display name */
    name: string;
    /** Project description */
    description: string;
    /** When the project was created */
    createdAt: number;
    /** When the project was last modified */
    updatedAt: number;
    /** Whether this is the default/untitled project */
    isDefault: boolean;
}

/**
 * Project creation parameters
 */
export interface CreateProjectParams {
    /** Project name */
    name: string;
    /** Optional description */
    description?: string;
    /** Whether this is the default project */
    isDefault?: boolean;
}

/**
 * Project update parameters
 */
export interface UpdateProjectParams {
    /** New project name */
    name?: string;
    /** New description */
    description?: string;
}

/**
 * Project switching context
 */
export interface ProjectSwitchContext {
    /** Previous project (null if none) */
    previousProject: Project | null;
    /** Current project */
    currentProject: Project;
    /** When the switch occurred */
    timestamp: number;
}

/**
 * Project storage operations result
 */
export type ProjectOperationResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Project service events
 */
export interface ProjectServiceEvents {
    /** Fired when a project is created */
    projectCreated: Project;
    /** Fired when a project is updated */
    projectUpdated: Project;
    /** Fired when a project is deleted */
    projectDeleted: { id: string };
    /** Fired when active project changes */
    projectSwitched: ProjectSwitchContext;
    /** Fired when projects are loaded */
    projectsLoaded: Project[];
}

/**
 * Project service interface
 */
export interface IProjectService {
    /** Initialize the service */
    initialize(): Promise<void>;
    /** Get all projects */
    getAllProjects(): Project[];
    /** Get current active project */
    getCurrentProject(): Project | null;
    /** Get project by ID */
    getProjectById(id: string): Project | null;
    /** Load projects from storage */
    loadProjects(): Promise<Result<Project[], StorageError>>;
    /** Create a new project */
    createProject(params: CreateProjectParams): Promise<Result<Project, StorageError>>;
    /** Update an existing project */
    updateProject(id: string, params: UpdateProjectParams): Promise<Result<Project, StorageError>>;
    /** Delete a project */
    deleteProject(id: string): Promise<Result<void, StorageError>>;
    /** Switch to a different project */
    switchToProject(id: string): Promise<Result<ProjectSwitchContext, StorageError>>;
    /** Rename a project */
    renameProject(id: string, newName: string): Promise<Result<Project, StorageError>>;
    /** Event subscription */
    on<K extends keyof ProjectServiceEvents>(
        event: K,
        listener: (data: ProjectServiceEvents[K]) => void
    ): void;
    /** Event unsubscription */
    off<K extends keyof ProjectServiceEvents>(
        event: K,
        listener: (data: ProjectServiceEvents[K]) => void
    ): void;
}
