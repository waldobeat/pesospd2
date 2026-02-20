import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs } from 'firebase/firestore';

export interface ChatMessage {
    id?: string;
    sender: string; // Email
    recipient: string; // Email or 'admin'
    text: string;
    timestamp: any;
    seen: boolean;
    senderName?: string;
    chatId: string; // userEmail-admin (always alphabetical or fixed format)
}

const COLLECTION_NAME = 'messages';

export const supportService = {
    sendMessage: async (sender: string, recipient: string, text: string, senderName?: string, isAdmin?: boolean) => {
        try {
            // Functional identities: sucursales talk to 'workshop'
            // If sender is admin, their functional ID is 'workshop'
            const functionalSender = isAdmin ? 'workshop' : sender;
            const functionalRecipient = isAdmin ? recipient : 'workshop';

            const userEmail = isAdmin ? recipient : sender;
            const chatId = `${userEmail.toLowerCase()}-workshop`;

            await addDoc(collection(db, COLLECTION_NAME), {
                sender: functionalSender,
                realSender: sender, // the actual email for tracking
                recipient: functionalRecipient,
                text,
                timestamp: serverTimestamp(),
                seen: false,
                senderName: isAdmin ? 'Taller' : (senderName || sender.split('@')[0]),
                chatId
            });
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    },

    // Subscribe to all messages for a specific user (between them and admin)
    subscribeToUserMessages: (userEmail: string, callback: (messages: ChatMessage[]) => void) => {
        const chatId = `${userEmail.toLowerCase()}-workshop`;
        const q = query(
            collection(db, COLLECTION_NAME),
            where('chatId', '==', chatId)
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ChatMessage[];

            // Local sort by timestamp
            messages.sort((a, b) => {
                const tA = a.timestamp?.toMillis?.() || 0;
                const tB = b.timestamp?.toMillis?.() || 0;
                return tA - tB;
            });

            callback(messages);
        }, (error) => {
            console.error("Error subscribing to messages:", error);
        });
    },

    // Admin: Subscribe to all latest messages to show in sidebar
    subscribeToAllConversations: (callback: (conversations: { [email: string]: ChatMessage }) => void) => {
        // We still need to order by timestamp to get latest, but we can limit to 100 to avoid huge loads
        const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const latestMsgs: { [email: string]: ChatMessage } = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data() as ChatMessage;
                // In this model, chatId is always {userEmail}-workshop
                // The 'otherParty' from the admin perspective is the one who isn't 'workshop'
                const otherParty = (data.sender === 'workshop' ? data.recipient : data.sender).toLowerCase();

                const isAdminEmail = otherParty === 'workshop' || otherParty === 'admin@sisdepe.com';

                if (otherParty && !isAdminEmail && !latestMsgs[otherParty]) {
                    latestMsgs[otherParty] = { id: doc.id, ...data };
                }
            });
            callback(latestMsgs);
        });
    },

    markAsSeen: async (messageIds: string[]) => {
        const promises = messageIds.map(id =>
            updateDoc(doc(db, COLLECTION_NAME, id), { seen: true })
        );
        await Promise.all(promises);
    },

    getUnseenCount: async (userEmail: string, isAdmin: boolean) => {
        const q = isAdmin
            ? query(collection(db, COLLECTION_NAME), where('recipient', '==', 'workshop'), where('seen', '==', false))
            : query(collection(db, COLLECTION_NAME), where('recipient', '==', userEmail.toLowerCase()), where('seen', '==', false));

        const snapshot = await getDocs(q);
        return snapshot.size;
    },

    // DANGEROUS: Clear all messages for maintenance
    clearAllMessages: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME));
            const snapshot = await getDocs(q);

            // Dynamic import to avoid circular or early execution issues, though already imported at top is fine
            const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');

            const promises = snapshot.docs.map(docSnapshot =>
                deleteDoc(firestoreDoc(db, COLLECTION_NAME, docSnapshot.id))
            );

            await Promise.all(promises);
            console.log("Database cleared successfully");
        } catch (e) {
            console.error("Error clearing database:", e);
            throw e;
        }
    }
};
