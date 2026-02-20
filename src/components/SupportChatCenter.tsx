import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase';
import type { ChatMessage } from '../services/SupportService';
import { supportService } from '../services/SupportService';
import { useAuthRole } from '../hooks/useAuthRole';
import { X, Send, User, MessageSquare, Search, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

interface SupportChatCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SupportChatCenter: React.FC<SupportChatCenterProps> = ({ isOpen, onClose }) => {
    const { isAdmin } = useAuthRole(auth.currentUser);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [conversations, setConversations] = useState<{ [email: string]: ChatMessage }>({});
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isMobileListOpen, setIsMobileListOpen] = useState(true);

    const currentUserEmail = auth.currentUser?.email || '';

    // Admin: Load Conversations List
    useEffect(() => {
        if (isOpen && isAdmin) {
            const unsubscribe = supportService.subscribeToAllConversations((data) => {
                setConversations(data);

                // If admin opens and no one is selected, 
                // auto-select the first user that has an UNSEEN message
                if (!selectedUser) {
                    const emailsWithUnseen = Object.keys(data).filter(email =>
                        !data[email].seen && data[email].recipient === 'admin@sisdepe.com'
                    );
                    if (emailsWithUnseen.length > 0) {
                        setSelectedUser(emailsWithUnseen[0]);
                    } else if (Object.keys(data).length > 0) {
                        // Fallback to latest conversation
                        setSelectedUser(Object.keys(data)[0]);
                    }
                }
            });
            return () => unsubscribe();
        }
    }, [isOpen, isAdmin]); // Remove selectedUser from here to avoid cycles

    // Load actual messages for selected chat
    useEffect(() => {
        if (isOpen) {
            const targetUser = isAdmin ? selectedUser : currentUserEmail;
            if (targetUser) {
                setIsLoading(true);
                const unsubscribe = supportService.subscribeToUserMessages(targetUser, (data) => {
                    setMessages(data);
                    setIsLoading(false);
                    scrollToBottom();

                    // Mark as seen
                    const unseenIds = data
                        .filter(m => !m.seen && (isAdmin ? m.recipient === 'admin@sisdepe.com' : m.recipient === currentUserEmail))
                        .map(m => m.id as string);
                    if (unseenIds.length > 0) {
                        supportService.markAsSeen(unseenIds);
                    }
                });
                return () => {
                    unsubscribe();
                };
            } else {
                setMessages([]);
            }
        }
    }, [isOpen, selectedUser, isAdmin, currentUserEmail]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        const recipient = isAdmin ? (selectedUser || '') : 'admin@sisdepe.com';
        if (!recipient) return;

        try {
            await supportService.sendMessage(currentUserEmail, recipient, newMessage.trim());
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    if (!isOpen) return null;

    const filteredConversations = Object.keys(conversations).filter(email =>
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conversations[email].senderName?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 lg:p-10 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-6xl bg-[#0a0a0c] border border-white/10 md:rounded-[40px] shadow-2xl flex h-full md:h-[80vh] overflow-hidden overflow-hidden">

                {/* Sidebar (Admin only) */}
                {isAdmin && (
                    <div className={clsx(
                        "w-full md:w-80 border-r border-white/5 flex flex-col bg-[#0d0d0f] transition-all",
                        isMobileListOpen ? "flex" : "hidden md:flex"
                    )}>
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white mb-4">Conversaciones</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="Buscar usuario..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredConversations.length === 0 ? (
                                <div className="p-8 text-center text-white/20 text-sm">No hay mensajes aún</div>
                            ) : (
                                filteredConversations.map(email => {
                                    const latest = conversations[email];
                                    const isSelected = selectedUser === email;
                                    return (
                                        <button
                                            key={email}
                                            onClick={() => {
                                                setSelectedUser(email);
                                                setIsMobileListOpen(false);
                                            }}
                                            className={clsx(
                                                "w-full p-4 flex items-center gap-4 rounded-2xl transition-all group relative",
                                                isSelected ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-white/60"
                                            )}
                                        >
                                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                                <User className={clsx("w-6 h-6", isSelected ? "text-white" : "text-blue-400")} />
                                            </div>
                                            <div className="text-left overflow-hidden">
                                                <div className="font-bold truncate uppercase tracking-tighter text-sm">
                                                    {latest.senderName || email.split('@')[0]}
                                                </div>
                                                <div className={clsx("text-xs truncate transition-colors", isSelected ? "text-blue-100" : "text-white/40")}>
                                                    {latest.text}
                                                </div>
                                            </div>
                                            {!latest.seen && latest.recipient === 'admin@sisdepe.com' && !isSelected && (
                                                <div className="absolute top-4 right-4 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0d0d0f]" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Main Chat Area */}
                <div className={clsx(
                    "flex-1 flex flex-col bg-[#0a0a0c] transition-all relative",
                    isAdmin && isMobileListOpen ? "hidden md:flex" : "flex"
                )}>
                    {/* Background Ambient Glow */}
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

                    {/* Chat Header */}
                    <div className="p-4 md:p-6 border-b border-white/5 backdrop-blur-md bg-[#0a0a0c]/80 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            {isAdmin && (
                                <button
                                    onClick={() => setIsMobileListOpen(true)}
                                    className="md:hidden p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                            )}
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-lg md:text-xl tracking-tight uppercase">
                                    {isAdmin
                                        ? (selectedUser ? (conversations[selectedUser]?.senderName || selectedUser.split('@')[0]) : "Soporte Técnico")
                                        : "Taller Central (Soporte)"}
                                </h3>
                                <p className="text-blue-500/60 text-[10px] md:text-xs font-bold tracking-widest uppercase">
                                    En línea • Soporte de Equipos
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 md:p-3 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
                            <X className="w-6 h-6 md:w-7 md:h-7" />
                        </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-black/20">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Sincronizando Chat...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                                <div className="w-20 h-20 rounded-3xl bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                                    <MessageSquare className="w-10 h-10 text-blue-500/20" />
                                </div>
                                <h4 className="text-white/40 font-bold text-xl">¿En qué podemos ayudarte?</h4>
                                <p className="text-white/20 text-sm max-w-xs">Escribe tu duda técnica aquí y un especialista del taller te responderá a la brevedad.</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.sender === currentUserEmail;
                                return (
                                    <div key={msg.id} className={clsx("flex flex-col group", isMe ? "items-end" : "items-start")}>
                                        <div className={clsx(
                                            "flex items-center gap-1.5 mb-1 px-1",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                                {isMe
                                                    ? "Tú dices"
                                                    : (isAdmin ? (msg.senderName || msg.sender.split('@')[0]) : "Taller responde")}
                                            </span>
                                        </div>
                                        <div className={clsx(
                                            "max-w-[85%] md:max-w-[70%] px-5 py-3 rounded-[1.5rem] shadow-lg transition-all",
                                            isMe
                                                ? "bg-blue-600 text-white rounded-tr-none"
                                                : "bg-white/10 text-white rounded-tl-none border border-white/5"
                                        )}>
                                            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                        <div className={clsx(
                                            "flex items-center gap-2 mt-1.5 px-2",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}>
                                            <span className="text-[10px] text-white/20 font-bold uppercase tracking-wider">
                                                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Enviando...'}
                                            </span>
                                            {msg.seen && isMe && (
                                                <span className="text-[9px] text-blue-400/50 font-black uppercase tracking-tighter">Visto</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 md:p-8 border-t border-white/5 bg-[#0a0a0c]">
                        {isAdmin && !selectedUser ? (
                            <div className="text-center text-white/20 text-sm py-4">Selecciona una conversación para responder</div>
                        ) : (
                            <div className="flex items-end gap-4 bg-white/5 border border-white/10 rounded-[2rem] p-2 focus-within:border-blue-500/50 transition-all shadow-inner">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Escribe un mensaje de soporte..."
                                    className="flex-1 bg-transparent text-white text-sm md:text-base px-5 py-3 outline-none resize-none custom-scrollbar min-h-[50px] max-h-[150px] placeholder:text-white/20"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim()}
                                    className={clsx(
                                        "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0 mb-1 mr-1",
                                        newMessage.trim()
                                            ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                                            : "bg-white/5 text-white/10"
                                    )}
                                >
                                    <Send className="w-5 h-5 md:w-6 md:h-6" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
