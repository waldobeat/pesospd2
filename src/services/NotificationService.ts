import { db } from '../firebase';
import {
    collection, addDoc, updateDoc, doc, onSnapshot,
    query, where, orderBy, Timestamp, getDocs
} from 'firebase/firestore';

export type NotificationType = 'issue_report' | 'status_change' | 'transfer_request';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    fromUser: string;      // email of whoever triggered this
    fromBranch?: string;   // branch of the sender
    targetBranch?: string; // 'taller' | 'central' | specific branch (undefined = all masters)
    relatedSerial?: string;
    relatedModel?: string;
    relatedInventoryId?: string;
    createdAt: Timestamp;
    read: boolean;
    resolved: boolean;
}

const COLLECTION = 'notifications';

export const notificationService = {

    /** Create a new notification (e.g. from damage report or status change) */
    create: async (
        payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'resolved'>
    ): Promise<string> => {
        try {
            const ref = await addDoc(collection(db, COLLECTION), {
                ...payload,
                createdAt: Timestamp.now(),
                read: false,
                resolved: false,
            });
            return ref.id;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    },

    /** Mark a notification as resolved (removed from active panel) */
    resolve: async (id: string, resolvedBy?: string): Promise<void> => {
        try {
            await updateDoc(doc(db, COLLECTION, id), {
                resolved: true,
                resolvedBy: resolvedBy ?? 'sistema',
                resolvedAt: Timestamp.now(),
            });
        } catch (error) {
            console.error('Error resolving notification:', error);
            throw error;
        }
    },

    /** Mark as read without resolving */
    markRead: async (id: string): Promise<void> => {
        try {
            await updateDoc(doc(db, COLLECTION, id), { read: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    },

    /**
     * Subscribe to active (unresolved) notifications for a target.
     * Masters (taller/central) see everything. Branch users see only their own.
     */
    subscribeToActive: (
        _userEmail: string,
        isMaster: boolean,
        callback: (notifications: AppNotification[]) => void
    ) => {
        // Masters see all unresolved notifications targeting 'taller' or 'central' or universal
        // For simplicity: masters subscribe to all unresolved, filter client-side
        const q = query(
            collection(db, COLLECTION),
            where('resolved', '==', false),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(
            q,
            (snap) => {
                const all = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as AppNotification[];

                // Masters see all; branch users see their own reports
                const filtered = isMaster ? all : all.filter(
                    (n) => n.fromUser === _userEmail
                );
                callback(filtered);
            },
            (err) => console.error('Error in notifications subscription:', err)
        );
    },

    /** One-time fetch of unresolved count */
    getUnresolvedCount: async (isMaster: boolean): Promise<number> => {
        try {
            const q = query(
                collection(db, COLLECTION),
                where('resolved', '==', false)
            );
            const snap = await getDocs(q);
            return isMaster ? snap.size : 0;
        } catch {
            return 0;
        }
    },
};
