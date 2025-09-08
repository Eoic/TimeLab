/**
 * Dependency injection container for managing service dependencies
 * Provides singleton instances with proper lifecycle management
 */

import type { IProjectService } from '../types/project';

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
    readonly _type: T;
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
    private readonly services = new Map<ServiceToken<unknown>, ServiceRegistration<unknown>>();

    /**
     * Register a transient service (new instance each time)
     */
    register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
        this.services.set(token as ServiceToken<unknown>, {
            factory: factory as () => unknown,
            singleton: false,
        });
    }

    /**
     * Register a singleton service (same instance always)
     */
    registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
        this.services.set(token as ServiceToken<unknown>, {
            factory: factory as () => unknown,
            singleton: true,
        });
    }

    /**
     * Get service instance by token
     */
    get<T>(token: ServiceToken<T>): T {
        const registration = this.services.get(token as ServiceToken<unknown>) as
            | ServiceRegistration<T>
            | undefined;
        if (!registration) {
            throw new Error(`Service not registered: ${token.name}`);
        }

        if (registration.singleton) {
            if (!registration.instance) {
                registration.instance = registration.factory();
            }
            return registration.instance as T;
        }

        return registration.factory() as T;
    }

    /**
     * Check if service is registered
     */
    has<T>(token: ServiceToken<T>): boolean {
        return this.services.has(token as ServiceToken<unknown>);
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
                if (typeof instance === 'object' && instance && 'destroy' in instance) {
                    instance.destroy();
                }
                registration.instance = undefined;
            }
        }
    }
}

// Service tokens
export const SERVICE_TOKENS = {
    ProjectService: { name: 'ProjectService', _type: null as unknown as IProjectService },
    LabelService: { name: 'LabelService', _type: null as unknown as any },
    DataManager: { name: 'DataManager', _type: null as unknown as any },
    DataService: { name: 'DataService', _type: null as unknown as any },
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
