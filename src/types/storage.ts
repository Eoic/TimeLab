/**
 * Types for persisted data in IndexedDB
 */

import type { IDBRecord } from '../platform';

/**
 * Label definition stored in IndexedDB
 */
export interface LabelDefinition extends IDBRecord {
    name: string;
    color: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * Time series label applied to a dataset
 */
export interface TimeSeriesLabel extends IDBRecord {
    startTime: number;
    endTime: number;
    labelDefId: string;
    datasetId: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * History entry stored in IndexedDB
 */
export interface HistoryEntry extends IDBRecord {
    action: string;
    timestamp: number;
    details?: Record<string, unknown>;
}
