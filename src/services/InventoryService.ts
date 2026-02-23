import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

export type InventoryStatus = 'OPERATIVO' | 'DAÑADO' | 'EN TALLER' | 'EN ESPERA' | 'ENVIADO' | 'TRANSFERIDO' | 'DADO DE BAJA';

export interface InventoryItem {
    id: string;
    weightType: string;
    scaleModel: string;
    serialNumber: string;
    branch: string;
    status: InventoryStatus;
    recordedBy: string;
    timestamp: Timestamp;
}

export const inventoryService = {
    addInventory: async (item: Omit<InventoryItem, 'id' | 'timestamp'>) => {
        try {
            const docRef = await addDoc(collection(db, 'inventory'), {
                ...item,
                timestamp: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding inventory item: ", error);
            throw error;
        }
    },
    updateInventoryStatus: async (id: string, status: InventoryStatus, newBranch?: string) => {
        try {
            const docRef = doc(db, 'inventory', id);
            const updates: any = { status };
            if (newBranch) {
                updates.branch = newBranch;
            }
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating inventory status: ", error);
            throw error;
        }
    },
    getInventory: async (): Promise<InventoryItem[]> => {
        try {
            const q = query(collection(db, 'inventory'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as InventoryItem[];
        } catch (error) {
            console.error("Error getting inventory: ", error);
            throw error;
        }
    },
    subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
        const q = query(collection(db, 'inventory'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (querySnapshot) => {
            const items = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as InventoryItem[];
            callback(items);
        }, (error) => {
            console.error("Error in inventory subscription:", error);
        });
    }
};
