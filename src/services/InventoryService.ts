import { db } from '../firebase';
import {
    collection, addDoc, updateDoc, doc, getDocs,
    onSnapshot, query, orderBy, where, Timestamp, getDoc, writeBatch
} from 'firebase/firestore';

export type InventoryStatus =
    | 'OPERATIVO'
    | 'DAÑADO'
    | 'EN TALLER'
    | 'EN ESPERA'
    | 'ENVIADO'
    | 'TRANSFERIDO'
    | 'DADO DE BAJA';

export const STATUS_LABELS: Record<InventoryStatus, string> = {
    'OPERATIVO': 'Operativo',
    'DAÑADO': 'Dañado',
    'EN TALLER': 'En Taller',
    'EN ESPERA': 'En Espera',
    'ENVIADO': 'Enviado',
    'TRANSFERIDO': 'Transferido',
    'DADO DE BAJA': 'Dado de Baja',
};

export const BRANCH_LABELS: Record<string, string> = {
    sandiego: 'San Diego',
    bosque: 'Bosque',
    trigal: 'Trigal',
    naguanagua: 'Naguanagua',
    guacara: 'Guacara',
    valencia: 'Valencia',
    central: 'Central',
    taller: 'Taller',
};

export const ALL_BRANCHES = Object.keys(BRANCH_LABELS).filter(
    (b) => b !== 'central' && b !== 'taller'
);

export interface InventoryItem {
    id: string;
    weightType: string;       // 'PESO' | 'BALANZA'
    scaleModel: string;
    serialNumber: string;
    branch: string;           // Current branch
    status: InventoryStatus;
    recordedBy: string;
    timestamp: Timestamp;     // Creation date
    updatedAt?: Timestamp;    // Last modification date
    updatedBy?: string;       // Who last modified
    description?: string;     // Optional notes/description on the item
}

export interface InventoryStats {
    total: number;
    operativo: number;
    danado: number;
    enTaller: number;
    enEspera: number;
    enviado: number;
    transferido: number;
    dadoDeBaja: number;
    byBranch: Record<string, number>;
    byModel: Record<string, number>;
}

export interface InventoryFilter {
    branch?: string;
    status?: InventoryStatus | '';
    weightType?: string;
    searchTerm?: string;
}

export const inventoryService = {

    /** Validates that a serial number is unique in Firestore */
    isSerialUnique: async (serialNumber: string): Promise<{ unique: boolean; existingItem?: InventoryItem }> => {
        try {
            const q = query(
                collection(db, 'inventory'),
                where('serialNumber', '==', serialNumber.trim())
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return { unique: true };
            const existing = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as InventoryItem;
            return { unique: false, existingItem: existing };
        } catch (error) {
            console.error('Error checking serial uniqueness:', error);
            return { unique: true }; // Allow on error (fail open)
        }
    },

    /** Add a new inventory item */
    addInventory: async (item: Omit<InventoryItem, 'id' | 'timestamp' | 'updatedAt' | 'updatedBy'>) => {
        try {
            const now = Timestamp.now();
            const docRef = await addDoc(collection(db, 'inventory'), {
                ...item,
                serialNumber: item.serialNumber.trim().toUpperCase(),
                timestamp: now,
                updatedAt: now,
                updatedBy: item.recordedBy,
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding inventory item: ', error);
            throw error;
        }
    },

    /** Update status (and optionally branch) of an inventory item */
    updateInventoryStatus: async (
        id: string,
        status: InventoryStatus,
        newBranch?: string,
        updatedBy?: string
    ) => {
        try {
            const docRef = doc(db, 'inventory', id);
            const updates: Record<string, unknown> = {
                status,
                updatedAt: Timestamp.now(),
                updatedBy: updatedBy || 'Sistema',
            };
            if (newBranch) {
                updates.branch = newBranch;
            }
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error('Error updating inventory status: ', error);
            throw error;
        }
    },

    /** Get a single inventory item by ID */
    getById: async (id: string): Promise<InventoryItem | null> => {
        try {
            const docRef = doc(db, 'inventory', id);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return null;
            return { id: snap.id, ...snap.data() } as InventoryItem;
        } catch (error) {
            console.error('Error getting inventory item:', error);
            return null;
        }
    },

    /** Get all inventory items (one-time fetch) */
    getInventory: async (): Promise<InventoryItem[]> => {
        try {
            const q = query(collection(db, 'inventory'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as InventoryItem[];
        } catch (error) {
            console.error('Error getting inventory: ', error);
            throw error;
        }
    },

    /** Real-time subscription to ALL inventory items */
    subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
        const q = query(collection(db, 'inventory'), orderBy('timestamp', 'desc'));
        return onSnapshot(
            q,
            (querySnapshot) => {
                const items = querySnapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as InventoryItem[];
                callback(items);
            },
            (error) => {
                console.error('Error in inventory subscription:', error);
            }
        );
    },

    /** Real-time subscription filtered by branch */
    subscribeToInventoryByBranch: (branch: string, callback: (items: InventoryItem[]) => void) => {
        const q = query(
            collection(db, 'inventory'),
            where('branch', '==', branch),
            orderBy('timestamp', 'desc')
        );
        return onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as InventoryItem[];
                callback(items);
            },
            (error) => {
                console.error('Error in branch inventory subscription:', error);
            }
        );
    },

    /** Compute inventory statistics from a list of items */
    computeStats: (items: InventoryItem[]): InventoryStats => {
        const stats: InventoryStats = {
            total: items.length,
            operativo: 0,
            danado: 0,
            enTaller: 0,
            enEspera: 0,
            enviado: 0,
            transferido: 0,
            dadoDeBaja: 0,
            byBranch: {},
            byModel: {},
        };

        for (const item of items) {
            // Count by status
            switch (item.status) {
                case 'OPERATIVO': stats.operativo++; break;
                case 'DAÑADO': stats.danado++; break;
                case 'EN TALLER': stats.enTaller++; break;
                case 'EN ESPERA': stats.enEspera++; break;
                case 'ENVIADO': stats.enviado++; break;
                case 'TRANSFERIDO': stats.transferido++; break;
                case 'DADO DE BAJA': stats.dadoDeBaja++; break;
            }

            // Count by branch
            const branchKey = item.branch || 'sin sucursal';
            stats.byBranch[branchKey] = (stats.byBranch[branchKey] || 0) + 1;

            // Count by model
            const modelKey = item.scaleModel || 'otro';
            stats.byModel[modelKey] = (stats.byModel[modelKey] || 0) + 1;
        }

        return stats;
    },

    /** Apply client-side filters to an inventory list */
    applyFilters: (items: InventoryItem[], filters: InventoryFilter): InventoryItem[] => {
        return items.filter((item) => {
            if (filters.branch && item.branch !== filters.branch) return false;
            if (filters.status && item.status !== filters.status) return false;
            if (filters.weightType && item.weightType !== filters.weightType) return false;

            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                return (
                    item.serialNumber.toLowerCase().includes(term) ||
                    item.scaleModel.toLowerCase().includes(term) ||
                    item.branch.toLowerCase().includes(term) ||
                    item.status.toLowerCase().includes(term) ||
                    (item.recordedBy || '').toLowerCase().includes(term) ||
                    (item.description || '').toLowerCase().includes(term)
                );
            }
            return true;
        });
    },

    /** Delete an inventory item (admin only) */
    deleteItem: async (id: string): Promise<void> => {
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'inventory', id));
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    },

    /** Export items to CSV string */
    exportToCSV: (items: InventoryItem[]): string => {
        const headers = [
            'Serial', 'Modelo', 'Tipo', 'Sucursal', 'Estatus',
            'Registrado Por', 'Última Mod. Por', 'F. Registro', 'F. Modificación', 'Descripción'
        ];
        const rows = items.map((item) => [
            item.serialNumber,
            item.scaleModel,
            item.weightType,
            BRANCH_LABELS[item.branch] || item.branch,
            item.status,
            item.recordedBy || '',
            item.updatedBy || '',
            item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString('es-VE') : '',
            item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString('es-VE') : '',
            item.description || '',
        ]);

        const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
        return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
    },
};
