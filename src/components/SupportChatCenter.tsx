import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase';
import type { ChatMessage } from '../services/SupportService';
import { supportService } from '../services/SupportService';
import { useAuthRole } from '../hooks/useAuthRole';
import { X, Send, User, MessageSquare, Search, ChevronLeft, Minus } from 'lucide-react';
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

    // In widget mode, isAdmin controls if they are in 'list' or 'chat' view
    const [view, setView] = useState<'list' | 'chat'>(isAdmin ? 'list' : 'chat');

    const currentUserEmail = auth.currentUser?.email || '';

    // Admin: Load Conversations List
    useEffect(() => {
        if (isOpen && isAdmin) {
            const unsubscribe = supportService.subscribeToAllConversations((data) => {
                setConversations(data);

                // If there are unseen messages for admin, maybe highlight the list
                // But we don't auto-select here to avoid jumping views
            });
            return () => unsubscribe();
        }
    }, [isOpen, isAdmin]);

    // Load actual messages for selected chat
    useEffect(() => {
        if (isOpen) {
            const targetUser = isAdmin ? selectedUser : currentUserEmail;
            if (targetUser) {
                setIsLoading(true);
                const unsubscribe = supportService.subscribeToUserMessages(targetUser, (data) => {
                    setMessages(data);
                    setIsLoading(false);
                    // Use a small timeout to ensure DOM is updated before scrolling
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);

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
                setIsLoading(false);
            }
        }
    }, [isOpen, selectedUser, isAdmin, currentUserEmail]);

    useEffect(() => {
        if (!isOpen) {
            // Reset view when closing
            if (isAdmin) setView('list');
        }
    }, [isOpen, isAdmin]);



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
        <div className="fixed bottom-4 right-4 z-[100] w-[90vw] md:w-[400px] h-[600px] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 duration-500">
            {/* Backdrop for mobile mostly, or just container shadow */}
            <div className="relative flex-1 flex flex-col bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden">

                {/* Header */}
                <div className="p-5 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-transparent flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {isAdmin && view === 'chat' && (
                            <button
                                onClick={() => setView('list')}
                                className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group">
                            <MessageSquare className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm uppercase tracking-tight">
                                {isAdmin
                                    ? (view === 'list' ? "Bandeja de Entrada" : (selectedUser ? (conversations[selectedUser]?.senderName || selectedUser.split('@')[0]) : "Chat"))
                                    : "Soporte Técnico"}
                            </h3>
                            <p className="text-blue-500/60 text-[9px] font-black tracking-widest uppercase">
                                {isAdmin && view === 'list' ? "Panel Taller" : "En línea ahora"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/20 hover:text-white">
                            <Minus className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/20 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {isAdmin && view === 'list' ? (
                        /* Admin List View */
                        <div className="flex-1 flex flex-col bg-black/20">
                            <div className="p-4 border-b border-white/5">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                                    <input
                                        type="text"
                                        placeholder="Buscar sucursal..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-2 text-xs text-white focus:border-blue-500/30 outline-none transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {filteredConversations.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                                        <MessageSquare className="w-10 h-10 mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Sin mensajes</p>
                                    </div>
                                ) : (
                                    filteredConversations.map(email => {
                                        const latest = conversations[email];
                                        return (
                                            <button
                                                key={email}
                                                onClick={() => {
                                                    setSelectedUser(email);
                                                    setView('chat');
                                                }}
                                                className="w-full p-4 flex items-center gap-4 rounded-3xl hover:bg-white/5 transition-all group relative border border-transparent hover:border-white/5"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                                    <User className="w-5 h-5 text-blue-400/50" />
                                                </div>
                                                <div className="text-left overflow-hidden flex-1">
                                                    <div className="font-bold truncate uppercase tracking-tighter text-xs text-white">
                                                        {latest.senderName || email.split('@')[0]}
                                                    </div>
                                                    <div className="text-[10px] truncate text-white/30 group-hover:text-white/50 transition-colors">
                                                        {latest.text}
                                                    </div>
                                                </div>
                                                {!latest.seen && latest.recipient === 'admin@sisdepe.com' && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                                )}
                                                <div className="text-[8px] font-black text-white/10 uppercase ml-2">
                                                    {latest.timestamp ? new Date(latest.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Chat View (Standard User or Admin talking to someone) */
                        <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0c]">
                            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-black/10">
                                {isLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                                        <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Sincronizando</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                                        <div className="w-16 h-16 rounded-3xl bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
                                            <MessageSquare className="w-8 h-8 text-blue-500/40" />
                                        </div>
                                        <h4 className="text-white font-bold text-sm uppercase">Canal de Soporte</h4>
                                        <p className="text-[10px] uppercase tracking-widest leading-loose">Escribe tu duda técnica aquí y te responderemos pronto.</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMe = msg.sender === currentUserEmail;
                                        return (
                                            <div key={msg.id} className={clsx("flex flex-col group", isMe ? "items-end" : "items-start")}>
                                                <div className={clsx(
                                                    "max-w-[85%] px-4 py-2.5 rounded-[1.2rem] shadow-sm transition-all",
                                                    isMe
                                                        ? "bg-blue-600 text-white rounded-tr-none"
                                                        : "bg-[#1c1c1e] text-white rounded-tl-none border border-white/5"
                                                )}>
                                                    <span className={clsx(
                                                        "text-[9px] font-black uppercase tracking-widest block mb-1 opacity-60",
                                                        isMe ? "text-blue-100" : "text-white/40"
                                                    )}>
                                                        {isMe
                                                            ? "Yo digo:"
                                                            : (isAdmin ? `${msg.senderName || msg.sender.split('@')[0]} dice:` : "Taller dice:")}
                                                    </span>
                                                    <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                </div>
                                                <div className={clsx(
                                                    "flex items-center gap-2 mt-1 px-2",
                                                    isMe ? "flex-row-reverse" : "flex-row"
                                                )}>
                                                    <span className="text-[8px] text-white/20 font-bold uppercase">
                                                        {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Enviando...'}
                                                    </span>
                                                    {msg.seen && isMe && (
                                                        <span className="text-[8px] text-blue-400/40 font-black uppercase tracking-tighter">Visto</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="p-5 border-t border-white/5 bg-[#0a0a0c]">
                                <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-[1.8rem] p-1.5 focus-within:border-blue-500/30 transition-all">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Escribir mensaje..."
                                        className="flex-1 bg-transparent text-white text-xs px-4 py-2 outline-none resize-none custom-scrollbar min-h-[40px] max-h-[120px] placeholder:text-white/20"
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
                                            "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 mr-0.5",
                                            newMessage.trim()
                                                ? "bg-blue-600 text-white hover:scale-105"
                                                : "bg-white/5 text-white/10"
                                        )}
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
