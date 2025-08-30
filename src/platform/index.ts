/**
 * Platform barrel export
 */

export type { IDBRecord } from './storage';
export {
    getAllRecords,
    saveRecord,
    deleteRecord,
    getAllLabels,
    saveLabel,
    deleteLabel,
    getAllHistory,
    saveHistory,
    deleteHistory,
    STORE_FILES,
    STORE_LABELS,
    STORE_HISTORY,
} from './storage';
