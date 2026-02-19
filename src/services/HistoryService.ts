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

export interface IssueRecord extends BaseRecord {
    type: 'issue';
    issueType: 'damaged_scale' | 'weight_error' | 'component_failure' | 'other';
    description: string;
    status: 'open' | 'in_repair' | 'resolved'; // Default 'open'
    reportedBy?: string;
}

export type HistoryItem = CalibrationRecord | RepairRecord | IssueRecord;

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

    save: async (record: Omit<CalibrationRecord, 'id' | 'date' | 'type'> | Omit<RepairRecord, 'id' | 'date' | 'type'> | Omit<IssueRecord, 'id' | 'date' | 'type'>, type: 'calibration' | 'repair' | 'issue'): Promise<HistoryItem | null> => {
        try {
            const date = new Date().toISOString();
            // Sanitize data: Firestore does not accept 'undefined'
            // We use JSON parse/stringify hack or manual check. 
            // Simple manual check for optional fields used:
            const safeRecord = {
                ...record,
                date,
                type,
                branch: record.branch || "N/A",
                note: record.note || "",
                // ReportedBy is optional on Base but specific to Issue. 
                // If it is in record, use it, else default.
                reportedBy: 'reportedBy' in record ? (record as IssueRecord).reportedBy || "Anon" : undefined
            };

            // Remove undefined keys specifically if any remain
            Object.keys(safeRecord).forEach(key => safeRecord[key as keyof typeof safeRecord] === undefined && delete safeRecord[key as keyof typeof safeRecord]);

            const docRef = await addDoc(collection(db, COLLECTION_NAME), safeRecord);

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

