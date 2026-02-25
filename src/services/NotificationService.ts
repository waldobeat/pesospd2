import { db } from '../firebase';
import {
    collection, addDoc, updateDoc, doc, onSnapshot,
    query, where, orderBy, Timestamp, getDocs
} from 'firebase/firestore';

export type NotificationType = 'issue_report' | 'status_change' | 'transfer_request' | 'broadcast';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    fromUser: string;       // email of whoever triggered this
    fromBranch?: string;    // branch of the sender
    targetBranch?: string;  // 'all' | 'taller' | 'central' | specific branch key
    targetUser?: string;    // specific user email for point-to-point messages
    relatedSerial?: string;
    relatedModel?: string;
    relatedInventoryId?: string;
    createdAt: Timestamp;
    read: boolean;
    resolved: boolean;
}

const COLLECTION = 'notifications';

export const notificationService = {

    /** Create a new notification */
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

    /** Mark a notification as resolved */
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
     * Subscribe to active (unresolved) notifications relevant to the current user.
     *
     * Visibility rules:
     *  - MASTERS (taller/central):
     *      • All operational notifications (issue_report, transfer_request, status_change)
     *        where targetUser is absent (not a feedback reply)
     *      • Broadcast notifications targeted at 'all' or their own branch
     *
     *  - BRANCH USERS:
     *      • Feedback notifications explicitly addressed to them (targetUser === email)
     *      • Broadcast notifications targeted at 'all' or their specific branch
     */
    subscribeToActive: (
        userEmail: string,
        isMaster: boolean,
        userBranch: string,
        callback: (notifications: AppNotification[]) => void
    ) => {
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

                let filtered: AppNotification[];

                if (isMaster) {
                    filtered = all.filter((n) => {
                        // Broadcasts to 'all' or to master's own branch
                        if (n.type === 'broadcast') {
                            return n.targetBranch === 'all' || n.targetBranch === userBranch;
                        }
                        // Operational alerts (not personal feedback)
                        return !n.targetUser;
                    });
                } else {
                    filtered = all.filter((n) => {
                        // Personal feedback (taller resolved an issue, etc.)
                        if (n.targetUser === userEmail) return true;
                        // Transfer requests or Status changes targeted at this branch
                        if ((n.type === 'transfer_request' || n.type === 'status_change') && n.targetBranch === userBranch) return true;
                        // Broadcast announcements
                        if (n.type === 'broadcast') {
                            return n.targetBranch === 'all' || n.targetBranch === userBranch;
                        }
                        return false;
                    });
                }

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
