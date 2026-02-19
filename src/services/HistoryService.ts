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

const STORAGE_KEY = 'calibration_history';

export const historyService = {
    getAll: (): HistoryItem[] => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];

            // Migration/Backward Compatibility: If 'type' is missing, assume 'calibration'
            return parsed.map((item: any) => {
                if (!item.type) {
                    return { ...item, type: 'calibration' } as CalibrationRecord;
                }
                return item as HistoryItem;
            });
        } catch (e) {
            console.error("Failed to load history", e);
            return [];
        }
    },

    save: (record: Omit<CalibrationRecord, 'id' | 'date' | 'type'> | Omit<RepairRecord, 'id' | 'date' | 'type'>, type: 'calibration' | 'repair') => {
        try {
            const history = historyService.getAll();
            const newRecord: HistoryItem = {
                ...record,
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                type
            } as HistoryItem; // TS casting purely because we are constructing it dynamically

            history.unshift(newRecord);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            return newRecord;
        } catch (e) {
            console.error("Failed to save record", e);
            return null;
        }
    },

    delete: (id: string) => {
        try {
            const history = historyService.getAll().filter(r => r.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.error("Failed to delete record", e);
        }
    },

    clear: () => {
        localStorage.removeItem(STORAGE_KEY);
    }
};
