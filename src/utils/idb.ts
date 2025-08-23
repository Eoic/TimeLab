// Minimal IndexedDB wrapper for persisting uploaded files
export type IDBRecord = Record<string, unknown> & { id: string };

const DB_NAME = 'timelab';
const DB_VERSION = 1;
const STORE_FILES = 'files';

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => {
            resolve(req.result);
        };
        req.onerror = () => {
            reject(req.error || new Error('Failed to open IndexedDB'));
        };
    });
}

export async function idbGetAll<T extends IDBRecord>(): Promise<T[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const req = store.getAll();
        req.onsuccess = () => {
            resolve(req.result as T[]);
        };
        req.onerror = () => {
            reject(req.error || new Error('Failed to getAll'));
        };
    });
}

export async function idbPut(record: IDBRecord): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const req = store.put(record);
        req.onsuccess = () => {
            resolve();
        };
        req.onerror = () => {
            reject(req.error || new Error('Failed to put'));
        };
    });
}

export async function idbDelete(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        const req = store.delete(id);
        req.onsuccess = () => {
            resolve();
        };
        req.onerror = () => {
            reject(req.error || new Error('Failed to delete'));
        };
    });
}
