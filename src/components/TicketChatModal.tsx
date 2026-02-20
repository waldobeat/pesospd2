import React, { useState, useEffect, useRef } from 'react';
import type { IssueRecord } from '../services/HistoryService';
import { historyService } from '../services/HistoryService';
import { X, Send, User, Wrench } from 'lucide-react';
import clsx from 'clsx';

interface TicketChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: IssueRecord | null;
    isAdmin: boolean;
    onUpdate: () => void;
}

export const TicketChatModal: React.FC<TicketChatModalProps> = ({ isOpen, onClose, record, isAdmin, onUpdate }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [isOpen, record?.userMessage, record?.adminMessage]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (!isOpen || !record) return null;

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        setIsSending(true);
        try {
            if (isAdmin) {
                await historyService.update(record.id!, {
                    adminMessage: newMessage.trim(),
                    statusSeen: false
                });
            } else {
                await historyService.update(record.id!, {
                    userMessage: newMessage.trim(),
                    adminStatusSeen: false
                });
            }
            setNewMessage('');
            onUpdate();
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Error al enviar el mensaje");
        } finally {
            setIsSending(false);
        }
    };

    // User identifier safely extracting from email or fallback.
    let parsedUser = 'Usuario';
    const email = record.reportedBy || record.user || '';
    if (email && email.includes('@')) {
        parsedUser = email.split('@')[0];
    } else if (record.branch) {
        parsedUser = record.branch;
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-2xl" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-[#121214] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                            {isAdmin ? <User className="w-5 h-5 text-blue-400" /> : <Wrench className="w-5 h-5 text-indigo-400" />}
                        </div>
                        <div>
                            <h3 className="text-white font-bold">{isAdmin ? `Usuario: ${parsedUser.toUpperCase()}` : 'Taller Central'}</h3>
                            <p className="text-xs text-white/40">Ticket: {record.serial}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0a0a0c]">

                    {/* System Initial Message */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-white/5 border border-white/10 text-white/40 text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                            Ticket creado el {new Date(record.date).toLocaleDateString()}
                        </div>
                    </div>

                    {/* Left Bubble (The Other Person) */}
                    {isAdmin ? (
                        // If Admin is viewing, left side is User
                        record.userMessage && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] bg-[#27272a] text-white rounded-2xl rounded-tl-sm px-4 py-2 border border-white/5 shadow-md">
                                    <div className="text-[10px] text-white/40 uppercase font-bold mb-1">{parsedUser}</div>
                                    <p className="text-sm whitespace-pre-wrap">{record.userMessage}</p>
                                </div>
                            </div>
                        )
                    ) : (
                        // If User is viewing, left side is Admin
                        record.adminMessage && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] bg-[#27272a] text-white rounded-2xl rounded-tl-sm px-4 py-2 border border-white/5 shadow-md">
                                    <div className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Taller Central</div>
                                    <p className="text-sm whitespace-pre-wrap">{record.adminMessage}</p>
                                </div>
                            </div>
                        )
                    )}

                    {/* Right Bubble (Me) */}
                    {isAdmin ? (
                        // If Admin is viewing, right side is Admin
                        record.adminMessage && (
                            <div className="flex justify-end">
                                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 shadow-md">
                                    <div className="text-[10px] text-blue-200 uppercase font-bold mb-1">Tú (Taller)</div>
                                    <p className="text-sm whitespace-pre-wrap">{record.adminMessage}</p>
                                </div>
                            </div>
                        )
                    ) : (
                        // If User is viewing, right side is User
                        record.userMessage && (
                            <div className="flex justify-end">
                                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 shadow-md">
                                    <div className="text-[10px] text-blue-200 uppercase font-bold mb-1">Tú ({parsedUser})</div>
                                    <p className="text-sm whitespace-pre-wrap">{record.userMessage}</p>
                                </div>
                            </div>
                        )
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                {(record.status !== 'dado_de_baja' && record.status !== 'recibido_en_sucursal') ? (
                    <div className="p-3 border-t border-white/10 bg-[#121214] shrink-0">
                        <div className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-2xl p-1 focus-within:border-blue-500/50 transition-colors">
                            <textarea
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="w-full bg-transparent text-white text-sm px-3 py-2 outline-none resize-none custom-scrollbar min-h-[44px] max-h-[120px]"
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!newMessage.trim() || isSending}
                                className={clsx(
                                    "p-2 rounded-xl shrink-0 transition-all mb-0.5 mr-0.5",
                                    newMessage.trim() && !isSending
                                        ? "bg-blue-500 text-white hover:bg-blue-400 hover:scale-105 shadow-lg"
                                        : "bg-white/5 text-white/20 cursor-not-allowed"
                                )}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 border-t border-white/10 bg-[#121214] shrink-0 text-center">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">El chat está cerrado para este equipo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
