import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';

export interface BaseRecord {
    id: string;
    date: string; // ISO string
    model: string;
    serial: string;
    branch?: string;
    note: string;
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

export type HistoryItem = CalibrationRecord | RepairRecord;

const COLLECTION_NAME = 'history';

export const historyService = {
    getAll: async (): Promise<HistoryItem[]> => {
        try {
            const historyRef = collection(db, COLLECTION_NAME);
            const q = query(historyRef, orderBy("date", "desc"));
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data
                } as HistoryItem;
            });
        } catch (e) {
            console.error("Failed to load history from Firestore", e);
            return [];
        }
    },

    save: async (record: Omit<CalibrationRecord, 'id' | 'date' | 'type'> | Omit<RepairRecord, 'id' | 'date' | 'type'>, type: 'calibration' | 'repair'): Promise<HistoryItem | null> => {
        try {
            const date = new Date().toISOString();
            const newRecordData = {
                ...record,
                date,
                type
            };

            const docRef = await addDoc(collection(db, COLLECTION_NAME), newRecordData);

            return {
                id: docRef.id,
                ...newRecordData
            } as HistoryItem;
        } catch (e) {
            console.error("Failed to save record to Firestore", e);
            throw e;
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (e) {
            console.error("Failed to delete record", e);
            throw e;
        }
    }
};

