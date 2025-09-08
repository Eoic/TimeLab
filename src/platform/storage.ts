/**
 * Platform adapter for IndexedDB storage operations
 * Isolates browser storage APIs from domain logic
 */

import type { Result } from '../shared';
import { StorageError, ok, err } from '../shared';

export type IDBRecord = Record<string, unknown> & { id: string };

const DB_NAME = 'timelab';
const DB_VERSION = 5; // Bump version to add projects store
const STORE_FILES = 'files';
const STORE_LABELS = 'labels'; // For label definitions
const STORE_TIME_SERIES_LABELS = 'timeSeriesLabels'; // For actual time series labels
const STORE_HISTORY = 'history';
const STORE_PROJECTS = 'projects'; // For project management

// Export store constants for use by other modules
export { STORE_FILES, STORE_LABELS, STORE_TIME_SERIES_LABELS, STORE_HISTORY, STORE_PROJECTS };

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (): void => {
            const db = req.result;

            // Create files store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES, { keyPath: 'id' });
            }

            // Create labels store if it doesn't exist (for label definitions)
            if (!db.objectStoreNames.contains(STORE_LABELS)) {
                db.createObjectStore(STORE_LABELS, { keyPath: 'id' });
            }

            // Create time series labels store if it doesn't exist (for actual chart labels)
            if (!db.objectStoreNames.contains(STORE_TIME_SERIES_LABELS)) {
                db.createObjectStore(STORE_TIME_SERIES_LABELS, { keyPath: 'id' });
            }

            // Create history store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
            }

            // Create projects store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
            }
        };
        req.onsuccess = (): void => {
            resolve(req.result);
        };
        req.onerror = (): void => {
            reject(req.error ?? new Error('Failed to open IndexedDB'));
        };
    });
}

export async function getAllRecords<T extends IDBRecord>(
    storeName: string = STORE_FILES
): Promise<Result<T[], StorageError>> {
    try {
        const db = await openDatabase();
        const result = await new Promise<T[]>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = (): void => {
                resolve(req.result as T[]);
            };
            req.onerror = (): void => {
                reject(req.error ?? new Error('Failed to getAll'));
            };
        });
        return ok(result);
    } catch (error) {
        return err(new StorageError('Failed to retrieve records', error));
    }
}

export async function getRecord<T extends IDBRecord>(
    id: string,
    storeName: string = STORE_FILES
): Promise<Result<T | null, StorageError>> {
    try {
        const db = await openDatabase();
        const result = await new Promise<T | null>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = (): void => {
                resolve(req.result ? (req.result as T) : null);
            };
            req.onerror = (): void => {
                reject(req.error ?? new Error('Failed to get record'));
            };
        });
        return ok(result);
    } catch (error) {
        return err(new StorageError('Failed to retrieve record', error));
    }
}

export async function saveRecord(
    record: IDBRecord,
    storeName: string = STORE_FILES
): Promise<Result<void, StorageError>> {
    try {
        const db = await openDatabase();

        // Check if the store exists before attempting to use it
        if (!db.objectStoreNames.contains(storeName)) {
            const availableStores = Array.from(db.objectStoreNames).join(', ');
            const errorMsg = `Object store '${storeName}' not found. Available stores: ${availableStores}. Database version: ${String(db.version)}`;
            return err(new StorageError(errorMsg));
        }

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(record);
            req.onsuccess = (): void => {
                resolve();
            };
            req.onerror = (): void => {
                reject(req.error ?? new Error('Failed to put record'));
            };
        });
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to save record', error));
    }
}

export async function deleteRecord(
    id: string,
    storeName: string = STORE_FILES
): Promise<Result<void, StorageError>> {
    try {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = (): void => {
                resolve();
            };
            req.onerror = (): void => {
                reject(req.error ?? new Error('Failed to delete record'));
            };
        });
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to delete record', error));
    }
}

/**
 * Reset the entire database (for debugging/development)
 * This will delete all data and recreate the database with current schema
 */
export async function resetDatabase(): Promise<Result<void, StorageError>> {
    try {
        // Close any existing connections
        const deleteReq = indexedDB.deleteDatabase(DB_NAME);
        await new Promise<void>((resolve, reject) => {
            deleteReq.onsuccess = () => {
                // Database deleted successfully
                resolve();
            };
            deleteReq.onerror = () => {
                reject(deleteReq.error ?? new Error('Failed to delete database'));
            };
        });

        // Reopen to trigger creation with current schema
        await openDatabase();
        // Database reset and recreated successfully
        return ok(undefined);
    } catch (error) {
        return err(new StorageError('Failed to reset database', error));
    }
}

// Convenience functions for specific stores

/**
 * Get all label definitions
 */
export async function getAllLabels<T extends IDBRecord>(): Promise<Result<T[], StorageError>> {
    return getAllRecords<T>(STORE_LABELS);
}

/**
 * Save a label definition
 */
export async function saveLabel(label: IDBRecord): Promise<Result<void, StorageError>> {
    return saveRecord(label, STORE_LABELS);
}

/**
 * Delete a label definition
 */
export async function deleteLabel(id: string): Promise<Result<void, StorageError>> {
    return deleteRecord(id, STORE_LABELS);
}

/**
 * Get all time series labels
 */
export async function getAllTimeSeriesLabels<T extends IDBRecord>(): Promise<
    Result<T[], StorageError>
> {
    return getAllRecords<T>(STORE_TIME_SERIES_LABELS);
}

/**
 * Save a time series label
 */
export async function saveTimeSeriesLabel(label: IDBRecord): Promise<Result<void, StorageError>> {
    return saveRecord(label, STORE_TIME_SERIES_LABELS);
}

/**
 * Delete a time series label
 */
export async function deleteTimeSeriesLabel(id: string): Promise<Result<void, StorageError>> {
    return deleteRecord(id, STORE_TIME_SERIES_LABELS);
}

/**
 * Get all history entries
 */
export async function getAllHistory<T extends IDBRecord>(): Promise<Result<T[], StorageError>> {
    return getAllRecords<T>(STORE_HISTORY);
}

/**
 * Save a history entry
 */
export async function saveHistory(entry: IDBRecord): Promise<Result<void, StorageError>> {
    return saveRecord(entry, STORE_HISTORY);
}

/**
 * Delete a history entry
 */
export async function deleteHistory(id: string): Promise<Result<void, StorageError>> {
    return deleteRecord(id, STORE_HISTORY);
}
