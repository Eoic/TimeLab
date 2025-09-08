/**
 * Service registry for initializing and managing all application services
 * Handles dependency injection and service lifecycle
 */

import { getServiceContainer, SERVICE_TOKENS } from './container';
import { createProjectService, ProjectService } from './projectService';
import { LabelService } from './labelService';
import { createDataService, type IDataService } from '../data/dataService';
import * as projectStorage from '../platform/projectStorage';
import { getDataManager } from '../data';

/**
 * Initialize all application services with dependencies
 */
export function initializeServices(): void {
    const container = getServiceContainer();

    // Register project service with injected storage dependency
    container.registerSingleton(SERVICE_TOKENS.ProjectService, () =>
        createProjectService(projectStorage)
    );

    // Register label service as singleton with data manager dependency
    container.registerSingleton(SERVICE_TOKENS.LabelService, () => {
        const dataManager = getDataManager();
        return new LabelService(dataManager);
    });

    // Register data manager as singleton
    container.registerSingleton(SERVICE_TOKENS.DataManager, () => getDataManager());

    // Register centralized data service
    container.registerSingleton(SERVICE_TOKENS.DataService, () => {
        const dataManager = getDataManager();
        return createDataService(dataManager);
    });
}

/**
 * Get project service instance
 */
export function getProjectService(): ProjectService {
    const container = getServiceContainer();
    return container.get(SERVICE_TOKENS.ProjectService) as ProjectService;
}

/**
 * Get label service instance
 */
export function getLabelService(): LabelService {
    const container = getServiceContainer();
    return container.get(SERVICE_TOKENS.LabelService) as LabelService;
}

/**
 * Get data manager instance
 */
export function getDataManagerService(): any {
    const container = getServiceContainer();
    return container.get(SERVICE_TOKENS.DataManager);
}

/**
 * Get centralized data service instance
 */
export function getDataService(): IDataService {
    const container = getServiceContainer();
    return container.get(SERVICE_TOKENS.DataService) as IDataService;
}

/**
 * Initialize and start all services
 */
export async function startServices(): Promise<void> {
    initializeServices();

    const projectService = getProjectService();
    const labelService = getLabelService();
    const dataService = getDataService();

    // Initialize services in dependency order
    await projectService.initialize();
    await labelService.initialize();
    await dataService.initialize();

    // Services are now ready to use
}

/**
 * Shutdown all services (useful for cleanup)
 */
export function shutdownServices(): void {
    const container = getServiceContainer();
    container.dispose();
}
