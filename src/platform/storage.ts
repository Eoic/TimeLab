/**
 * Platform adapter for IndexedDB storage operations
 * Isolates browser storage APIs from domain logic
 */

import type { Result } from '../shared';
import { StorageError, ok, err } from '../shared';

export type IDBRecord = Record<string, unknown> & { id: string };

const DB_NAME = 'timelab';
const DB_VERSION = 1;
const STORE_FILES = 'files';

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (): void => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES, { keyPath: 'id' });
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

export async function getAllRecords<T extends IDBRecord>(): Promise<Result<T[], StorageError>> {
    try {
        const db = await openDatabase();
        const result = await new Promise<T[]>((resolve, reject) => {
            const tx = db.transaction(STORE_FILES, 'readonly');
            const store = tx.objectStore(STORE_FILES);
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

export async function saveRecord(record: IDBRecord): Promise<Result<void, StorageError>> {
    try {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_FILES, 'readwrite');
            const store = tx.objectStore(STORE_FILES);
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

export async function deleteRecord(id: string): Promise<Result<void, StorageError>> {
    try {
        const db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_FILES, 'readwrite');
            const store = tx.objectStore(STORE_FILES);
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
