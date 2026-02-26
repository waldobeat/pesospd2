import { db } from '../firebase';
import {
    collection, addDoc, updateDoc, doc, getDocs,
    onSnapshot, query, orderBy, where, Timestamp, getDoc, deleteDoc
} from 'firebase/firestore';

export type InventoryStatus =
    | 'OPERATIVO'
    | 'DAÑADO'
    | 'EN TALLER'
    | 'REPARANDO'
    | 'EN ESPERA'
    | 'ENVIADO'
    | 'TRANSFERIDO'
    | 'DADO DE BAJA'
    | 'REPARADO'
    | 'EN TRÁNSITO';

export const STATUS_LABELS: Record<InventoryStatus, string> = {
    'OPERATIVO': 'Operativo',
    'DAÑADO': 'Dañado',
    'EN TALLER': 'En Taller',
    'REPARANDO': 'Reparando en este momento ⚙️',
    'EN ESPERA': 'En Espera',
    'ENVIADO': 'Enviado',
    'TRANSFERIDO': 'Transferido',
    'DADO DE BAJA': 'Dado de Baja',
    'REPARADO': 'Reparado - Esperando Envío ✅',
    'EN TRÁNSITO': 'En Tránsito 🚚',
};

export const BRANCH_LABELS: Record<string, string> = {
    taller: 'Taller',
    sandiego: 'San Diego',
    acacias: 'Acacias',
    victoria: 'Victoria',
    naguanagua: 'Naguanagua',
    bosque: 'Bosque',
    central: 'Central',
    mora: 'Mora',
    villas: 'Villas',
    barquisimeto: 'Barquisimeto',
    tucacas: 'Tucacas',
    castano: 'Castaño',
    circulo: 'Circulo',
    guacara: 'Guacara',
    sanjuan: 'San Juan',
    ipsfa: 'Ipsfa',
};

export const ALL_BRANCHES = Object.keys(BRANCH_LABELS).filter(
    (b) => b !== 'central' && b !== 'taller'
);

/** Info about a pending inter-branch transfer awaiting confirmation */
export interface PendingTransfer {
    from: string;          // branch key of sender
    to: string;            // branch key of receiver
    initiatedBy: string;   // email of the user who initiated
    initiatedAt: Timestamp;
    notes?: string;
    originalStatus: InventoryStatus; // The status before EN TRÁNSITO
}

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
    // Transfer confirmation fields
    pendingTransfer?: PendingTransfer;
    hasPendingTransfer?: boolean; // Indexed helper field for Firestore queries
    lastBranch?: string;          // Remembers the previous branch for notifications
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
    reparado: number;
    enTransito: number;
    byBranch: Record<string, number>;
    byModel: Record<string, number>;
}

export interface InventoryFilter {
    branch?: string;
    status?: InventoryStatus | '';
    weightType?: string;
    searchTerm?: string;
}

const sanitize = (val: any) => {
    if (val === null || val === undefined) return null;
    if (typeof val !== 'object') return val;
    const cleaned = { ...val };
    Object.keys(cleaned).forEach((key) => {
        if (cleaned[key] === undefined) delete cleaned[key];
        else if (cleaned[key] && typeof cleaned[key] === 'object' && !cleaned[key].toDate) {
            cleaned[key] = sanitize(cleaned[key]);
        }
    });
    return cleaned;
};

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
            return { unique: true };
        }
    },

    /** Add a new inventory item */
    addInventory: async (item: Omit<InventoryItem, 'id' | 'timestamp' | 'updatedAt' | 'updatedBy'>) => {
        try {
            const now = Timestamp.now();
            const docRef = await addDoc(collection(db, 'inventory'), sanitize({
                ...item,
                serialNumber: item.serialNumber.trim().toUpperCase(),
                timestamp: now,
                updatedAt: now,
                updatedBy: item.recordedBy,
                hasPendingTransfer: false,
            }));
            return docRef.id;
        } catch (error) {
            console.error('Error adding inventory item: ', error);
            throw error;
        }
    },

    /**
     * Initiate a transfer: sets status to EN TRÁNSITO and writes pendingTransfer.
     * Called when a user selects ENVIADO or TRANSFERIDO.
     */
    initiateTransfer: async (
        id: string,
        to: string,
        initiatedBy: string,
        notes?: string
    ): Promise<void> => {
        try {
            const itemSnap = await getDoc(doc(db, 'inventory', id));
            if (!itemSnap.exists()) throw new Error('Item not found');
            const itemData = itemSnap.data() as InventoryItem;
            const from = itemData.branch;
            const originalStatus = itemData.status;

            await updateDoc(doc(db, 'inventory', id), sanitize({
                status: 'EN TRÁNSITO' satisfies InventoryStatus,
                updatedAt: Timestamp.now(),
                updatedBy: initiatedBy,
                hasPendingTransfer: true,
                pendingTransfer: {
                    from,
                    to,
                    initiatedBy,
                    initiatedAt: Timestamp.now(),
                    notes: notes || '',
                    originalStatus,
                } satisfies PendingTransfer,
            }));
        } catch (error) {
            console.error('Error initiating transfer:', error);
            throw error;
        }
    },

    /**
     * Confirm receipt of a transferred item.
     * Clears pendingTransfer, moves item to destination branch, sets new status.
     */
    confirmTransfer: async (
        id: string,
        confirmedBy: string,
        newStatus: InventoryStatus = 'EN TALLER'
    ): Promise<void> => {
        try {
            const itemSnap = await getDoc(doc(db, 'inventory', id));
            if (!itemSnap.exists()) throw new Error('Item not found');
            const item = itemSnap.data() as InventoryItem;
            const destination = item.pendingTransfer?.to || item.branch;
            const sourceBranch = item.pendingTransfer?.from || item.branch;

            await updateDoc(doc(db, 'inventory', id), sanitize({
                status: newStatus,
                branch: destination,
                lastBranch: sourceBranch, // Save for later status-change notifications
                updatedAt: Timestamp.now(),
                updatedBy: confirmedBy,
                hasPendingTransfer: false,
                pendingTransfer: null,
            }));
        } catch (error) {
            console.error('Error confirming transfer:', error);
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
            if (newBranch) updates.branch = newBranch;
            await updateDoc(docRef, sanitize(updates));
        } catch (error) {
            console.error('Error updating inventory status: ', error);
            throw error;
        }
    },

    /** General update for an inventory item */
    updateItem: async (id: string, updates: Partial<InventoryItem>) => {
        try {
            const docRef = doc(db, 'inventory', id);
            await updateDoc(docRef, sanitize({
                ...updates,
                updatedAt: Timestamp.now(),
            }));
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    },

    /** Get a single inventory item by ID */
    getById: async (id: string): Promise<InventoryItem | null> => {
        try {
            const snap = await getDoc(doc(db, 'inventory', id));
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
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
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
            (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[]),
            (error) => console.error('Error in inventory subscription:', error)
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
            (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[]),
            (error) => console.error('Error in branch inventory subscription:', error)
        );
    },

    /**
     * Real-time subscription to items with a pending transfer addressed to `targetBranch`.
     * Uses the indexed `hasPendingTransfer` boolean field for efficient querying.
     */
    subscribeToPendingTransfers: (
        targetBranch: string,
        callback: (items: InventoryItem[]) => void
    ) => {
        const q = query(
            collection(db, 'inventory'),
            where('hasPendingTransfer', '==', true)
        );
        return onSnapshot(
            q,
            (snap) => {
                const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[];
                // Filter client-side: only items going TO this branch (or master sees all)
                const relevant = targetBranch === 'taller' || targetBranch === 'central'
                    ? all  // master users see ALL pending transfers
                    : all.filter((item) => item.pendingTransfer?.to === targetBranch);
                callback(relevant);
            },
            (error) => console.error('Error in pending transfers subscription:', error)
        );
    },

    /** Compute inventory statistics from a list of items */
    computeStats: (items: InventoryItem[]): InventoryStats => {
        const stats: InventoryStats = {
            total: items.length,
            operativo: 0, danado: 0, enTaller: 0, enEspera: 0,
            enviado: 0, transferido: 0, dadoDeBaja: 0, reparado: 0, enTransito: 0,
            byBranch: {}, byModel: {},
        };

        for (const item of items) {
            switch (item.status) {
                case 'OPERATIVO': stats.operativo++; break;
                case 'DAÑADO': stats.danado++; break;
                case 'EN TALLER':
                case 'REPARANDO':
                    stats.enTaller++; break;
                case 'EN ESPERA': stats.enEspera++; break;
                case 'ENVIADO': stats.enviado++; break;
                case 'TRANSFERIDO': stats.transferido++; break;
                case 'DADO DE BAJA': stats.dadoDeBaja++; break;
                case 'REPARADO': stats.reparado++; break;
                case 'EN TRÁNSITO': stats.enTransito++; break;
            }
            const bk = item.branch || 'sin sucursal';
            stats.byBranch[bk] = (stats.byBranch[bk] || 0) + 1;
            const mk = item.scaleModel || 'otro';
            stats.byModel[mk] = (stats.byModel[mk] || 0) + 1;
        }
        return stats;
    },

    /** Apply client-side filters to an inventory list */
    applyFilters: (items: InventoryItem[], filters: InventoryFilter): InventoryItem[] => {
        return items.filter((item) => {
            if (filters.branch && item.branch !== filters.branch) return false;
            if (filters.status) {
                if (filters.status === 'EN TALLER') {
                    if (item.status !== 'EN TALLER' && item.status !== 'REPARANDO' && item.status !== 'REPARADO') return false;
                } else {
                    if (item.status !== filters.status) return false;
                }
            }
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
            await deleteDoc(doc(db, 'inventory', id));
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    },

    /** Export items to CSV string (UTF-8 with BOM for Excel) */
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
        return '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
    },
};
