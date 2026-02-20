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
    sendMessage: async (sender: string, recipient: string, text: string, senderName?: string) => {
        try {
            // Consistent chatId: always "email-admin" for simplicity
            const userEmail = sender === 'admin@sisdepe.com' ? recipient : sender;
            const chatId = `${userEmail}-admin`;

            await addDoc(collection(db, COLLECTION_NAME), {
                sender,
                recipient,
                text,
                timestamp: serverTimestamp(),
                seen: false,
                senderName: senderName || sender.split('@')[0],
                chatId
            });
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    },

    // Subscribe to all messages for a specific user (between them and admin)
    subscribeToUserMessages: (userEmail: string, callback: (messages: ChatMessage[]) => void) => {
        const chatId = `${userEmail}-admin`;
        const q = query(
            collection(db, COLLECTION_NAME),
            where('chatId', '==', chatId)
            // Removed orderBy to avoid requiring composite index, sorting locally instead
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
                const otherParty = data.sender === 'admin@sisdepe.com' ? data.recipient : data.sender;
                if (otherParty && !latestMsgs[otherParty]) {
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
