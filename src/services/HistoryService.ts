import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';

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
    status: 'en_proceso' | 'recibido' | 'en_taller' | 'resuelto' | 'dado_de_baja';
    reportedBy?: string;
    diagnostic?: string;
    solution?: string;
}

export type HistoryItem = CalibrationRecord | RepairRecord | IssueRecord;

const COLLECTION_NAME = 'history';

export const historyService = {
    getAll: async (userEmail?: string, isAdmin: boolean = false): Promise<HistoryItem[]> => {
        try {
            const historyRef = collection(db, COLLECTION_NAME);
            let q;

            if (isAdmin) {
                // Admin sees ALL records
                const q = query(historyRef, orderBy("date", "desc"));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryItem));
            } else if (userEmail) {
                // Standard user: Query by 'user' OR 'reportedBy'
                // We run two queries in parallel and merge results.
                const q1 = query(historyRef, where("user", "==", userEmail));
                const q2 = query(historyRef, where("reportedBy", "==", userEmail));

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                const results = new Map<string, HistoryItem>();

                [...snap1.docs, ...snap2.docs].forEach(doc => {
                    results.set(doc.id, { id: doc.id, ...doc.data() } as HistoryItem);
                });

                const items = Array.from(results.values());
                // Sort in memory
                return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            } else {
                return []; // No public access
            }
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
                // ReportedBy is specific to Issue, but we now have generic 'user' on BaseRecord
                user: record.user || "Anon",
                // Keep reportedBy for backward compatibility or specific issue logic if needed
                reportedBy: 'reportedBy' in record ? (record as IssueRecord).reportedBy : record.user
            };

            // Remove undefined keys specifically if any remain
            Object.keys(safeRecord).forEach(key => safeRecord[key as keyof typeof safeRecord] === undefined && delete safeRecord[key as keyof typeof safeRecord]);

            const docRef = await addDoc(collection(db, COLLECTION_NAME), safeRecord);

            return {
                id: docRef.id,
                ...safeRecord
            } as HistoryItem;
        } catch (e) {
            console.error("Failed to save record to Firestore", e);
            throw e;
        }
    },

    update: async (id: string, updates: Partial<HistoryItem>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await import('firebase/firestore').then(({ updateDoc }) => updateDoc(docRef, updates));
        } catch (e) {
            console.error("Failed to update record", e);
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

