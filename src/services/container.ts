/**
 * Dependency injection container for managing service dependencies
 * Provides singleton instances with proper lifecycle management
 */

import type { DataManager } from '../charts/timeSeries';
import type { IDataService } from '../data/dataService';
import type { IProjectService } from '../types/project';

import type { LabelService } from './labelService';

// Service token types
export interface IServiceContainer {
    register<T>(token: ServiceToken<T>, factory: () => T): void;
    registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void;
    get<T>(token: ServiceToken<T>): T;
    has<T>(token: ServiceToken<T>): boolean;
    clear(): void;
    dispose(): void;
}

export interface ServiceToken<T = unknown> {
    readonly _type?: T; // Make _type optional since it's only for type inference
    readonly name: string;
}

// Service factory type
export type ServiceFactory<T> = () => T;

// Service registration info
interface ServiceRegistration<T> {
    factory: ServiceFactory<T>;
    singleton: boolean;
    instance?: T;
}

/**
 * Simple dependency injection container implementation
 */
export class ServiceContainer implements IServiceContainer {
    private readonly services = new Map<ServiceToken, ServiceRegistration<unknown>>();

    /**
     * Register a transient service (new instance each time)
     */
    register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
        this.services.set(token as ServiceToken, {
            factory: factory as ServiceFactory<unknown>,
            singleton: false,
        });
    }

    /**
     * Register a singleton service (same instance always)
     */
    registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
        this.services.set(token as ServiceToken, {
            factory: factory as ServiceFactory<unknown>,
            singleton: true,
        });
    }

    /**
     * Get service instance by token
     */
    get<T>(token: ServiceToken<T>): T {
        const registration = this.services.get(token as ServiceToken);
        if (!registration) {
            throw new Error(`Service not registered: ${token.name}`);
        }

        // Type assertion is safe here because the token guarantees the type
        const typedRegistration = registration as ServiceRegistration<T>;

        if (typedRegistration.singleton) {
            if (!typedRegistration.instance) {
                typedRegistration.instance = typedRegistration.factory();
            }
            return typedRegistration.instance;
        }

        return typedRegistration.factory();
    }

    /**
     * Check if service is registered
     */
    has<T>(token: ServiceToken<T>): boolean {
        return this.services.has(token as ServiceToken);
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.dispose();
        this.services.clear();
    }

    /**
     * Dispose all singleton instances that implement dispose
     */
    dispose(): void {
        for (const [, registration] of this.services.entries()) {
            if (registration.singleton && registration.instance) {
                const instance = registration.instance;
                if (typeof instance === 'object' && 'destroy' in instance) {
                    (instance.destroy as () => void)();
                }
                registration.instance = undefined;
            }
        }
    }
}

// Service tokens - using branded types for better type safety
export const SERVICE_TOKENS = {
    ProjectService: { name: 'ProjectService' } as ServiceToken<IProjectService>,
    LabelService: { name: 'LabelService' } as ServiceToken<LabelService>,
    DataManager: { name: 'DataManager' } as ServiceToken<DataManager>,
    DataService: { name: 'DataService' } as ServiceToken<IDataService>,
} as const;

// Global container instance
let containerInstance: ServiceContainer | null = null;

/**
 * Get the global service container
 */
export function getServiceContainer(): ServiceContainer {
    if (!containerInstance) {
        containerInstance = new ServiceContainer();
    }
    return containerInstance;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetServiceContainer(): void {
    if (containerInstance) {
        containerInstance.dispose();
        containerInstance = null;
    }
}
