import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export interface InventoryItem {
    weightType: string;
    scaleModel: string;
    serialNumber: string;
    branch: string;
    recordedBy: string;
    timestamp: Timestamp;
}

export const inventoryService = {
    addInventory: async (item: Omit<InventoryItem, 'timestamp'>) => {
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
    }
};
