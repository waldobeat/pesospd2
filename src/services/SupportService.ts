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
}

const COLLECTION_NAME = 'messages';

export const supportService = {
    sendMessage: async (sender: string, recipient: string, text: string, senderName?: string) => {
        try {
            await addDoc(collection(db, COLLECTION_NAME), {
                sender,
                recipient,
                text,
                timestamp: serverTimestamp(),
                seen: false,
                senderName: senderName || sender.split('@')[0]
            });
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    },

    // Subscribe to all messages for a specific user (between them and admin)
    subscribeToUserMessages: (userEmail: string, callback: (messages: ChatMessage[]) => void) => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('sender', 'in', [userEmail, 'admin@sisdepe.com']),
            where('recipient', 'in', [userEmail, 'admin@sisdepe.com']),
            orderBy('timestamp', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ChatMessage[];
            callback(messages);
        });
    },

    // Admin: Subscribe to all latest messages to show in sidebar
    subscribeToAllConversations: (callback: (conversations: { [email: string]: ChatMessage }) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const latestMsgs: { [email: string]: ChatMessage } = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data() as ChatMessage;
                const otherParty = data.sender === 'admin@sisdepe.com' ? data.recipient : data.sender;
                if (!latestMsgs[otherParty]) {
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
            ? query(collection(db, COLLECTION_NAME), where('recipient', '==', 'admin@sisdepe.com'), where('seen', '==', false))
            : query(collection(db, COLLECTION_NAME), where('recipient', '==', userEmail), where('seen', '==', false));

        const snapshot = await getDocs(q);
        return snapshot.size;
    }
};
