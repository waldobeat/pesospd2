import { db } from '../firebase';
import {
    collection, getDocs, addDoc, deleteDoc, doc,
    query, orderBy, where, updateDoc
} from 'firebase/firestore';
import { inventoryService } from './InventoryService';
import type { InventoryStatus } from './InventoryService';

export interface BaseRecord {
    id: string;
    date: string; // ISO string
    model: string;
    serial: string;
    branch?: string;
    note: string;
    user?: string; // Email of the user who performed the action
}

export interface CalibrationRecord extends BaseRecord {
    type: 'calibration';
    finalWeight: number; // in kg
    targetWeight: number; // in kg
    passed: boolean;
}

export interface RepairRecord extends BaseRecord {
    type: 'repair';
    diagnosis: string;
    solution: string;
    repaired: boolean;
}

export interface IssueRecord extends BaseRecord {
    type: 'issue';
    issueType: 'damaged_scale' | 'weight_error' | 'component_failure' | 'other';
    description: string;
    status: 'open' | 'in_repair' | 'resolved';
    reportedBy?: string;
}

export interface InventoryOpRecord extends BaseRecord {
    type: 'inventory_op';
    status: InventoryStatus;
    destination?: string; // Used when status is 'ENVIADO' or 'TRANSFERIDO'
    inventoryId: string;  // The Firestore ID of the Inventory item
    updatedBy?: string;
}

export type HistoryItem = CalibrationRecord | RepairRecord | IssueRecord | InventoryOpRecord;

const COLLECTION_NAME = 'history';

export const historyService = {
    getAll: async (userEmail?: string, isAdmin: boolean = false): Promise<HistoryItem[]> => {
        try {
            const historyRef = collection(db, COLLECTION_NAME);

            if (isAdmin) {
                const q = query(historyRef, orderBy('date', 'desc'));
                const snapshot = await getDocs(q);
                return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HistoryItem));
            } else if (userEmail) {
                const q1 = query(historyRef, where('user', '==', userEmail));
                const q2 = query(historyRef, where('reportedBy', '==', userEmail));

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                const results = new Map<string, HistoryItem>();
                [...snap1.docs, ...snap2.docs].forEach((d) => {
                    results.set(d.id, { id: d.id, ...d.data() } as HistoryItem);
                });

                const items = Array.from(results.values());
                return items.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );
            } else {
                return [];
            }
        } catch (e) {
            console.error('Failed to load history from Firestore', e);
            return [];
        }
    },

    save: async (
        record:
            | Omit<CalibrationRecord, 'id' | 'date' | 'type'>
            | Omit<RepairRecord, 'id' | 'date' | 'type'>
            | Omit<IssueRecord, 'id' | 'date' | 'type'>
            | Omit<InventoryOpRecord, 'id' | 'date' | 'type'>,
        type: 'calibration' | 'repair' | 'issue' | 'inventory_op'
    ): Promise<HistoryItem | null> => {
        try {
            const date = new Date().toISOString();
            const safeRecord: Record<string, unknown> = {
                ...record,
                date,
                type,
                branch: record.branch || 'N/A',
                note: record.note || '',
                user: record.user || 'Anon',
                reportedBy: 'reportedBy' in record
                    ? (record as IssueRecord).reportedBy
                    : record.user,
            };

            if (type === 'inventory_op') {
                const opRecord = record as Omit<InventoryOpRecord, 'id' | 'date' | 'type'>;
                if (opRecord.destination) safeRecord.destination = opRecord.destination;
                if (opRecord.inventoryId) safeRecord.inventoryId = opRecord.inventoryId;
                if (opRecord.updatedBy) safeRecord.updatedBy = opRecord.updatedBy;
            }

            // Remove undefined keys — Firestore does not accept undefined values
            Object.keys(safeRecord).forEach((key) => {
                if (safeRecord[key] === undefined) delete safeRecord[key];
            });

            const docRef = await addDoc(collection(db, COLLECTION_NAME), safeRecord);

            // Sync inventory status when this is an inventory operation
            if (type === 'inventory_op') {
                const opRecord = record as Omit<InventoryOpRecord, 'id' | 'date' | 'type'>;
                if (opRecord.inventoryId) {
                    await inventoryService.updateInventoryStatus(
                        opRecord.inventoryId,
                        opRecord.status,
                        opRecord.destination,
                        opRecord.updatedBy || record.user || 'Sistema'
                    );
                }
            }

            return { id: docRef.id, ...safeRecord } as HistoryItem;
        } catch (e) {
            console.error('Failed to save record to Firestore', e);
            throw e;
        }
    },

    update: async (id: string, updates: Partial<HistoryItem>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, updates as Record<string, unknown>);
        } catch (e) {
            console.error('Failed to update record', e);
            throw e;
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (e) {
            console.error('Failed to delete record', e);
            throw e;
        }
    },
};
