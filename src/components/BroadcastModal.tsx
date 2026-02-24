import React, { useState } from 'react';
import { auth } from '../firebase';
import { notificationService } from '../services/NotificationService';
import { BRANCH_LABELS } from '../services/InventoryService';
import {
    X, Megaphone, Send, CheckCircle, Users, User, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';

interface BroadcastModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Build target list: 'all' + every branch
const BROADCAST_TARGETS: { key: string; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: '@Todos los usuarios', icon: Users },
    { key: 'sandiego', label: '@San Diego', icon: User },
    { key: 'bosque', label: '@Bosque', icon: User },
    { key: 'trigal', label: '@Trigal', icon: User },
    { key: 'naguanagua', label: '@Naguanagua', icon: User },
    { key: 'guacara', label: '@Guacara', icon: User },
    { key: 'valencia', label: '@Valencia', icon: User },
    { key: 'taller', label: '@Taller', icon: User },
    { key: 'central', label: '@Central', icon: User },
];

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ isOpen, onClose }) => {
    const [targetBranch, setTargetBranch] = useState('all');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const selectedTarget = BROADCAST_TARGETS.find((t) => t.key === targetBranch) ?? BROADCAST_TARGETS[0];

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;

        setLoading(true);
        const user = auth.currentUser;
        const userEmail = user?.email ?? 'admin';
        const userBranch = userEmail.split('@')[0];

        try {
            await notificationService.create({
                type: 'broadcast',
                title: title.trim(),
                message: message.trim(),
                fromUser: userEmail,
                fromBranch: userBranch,
                targetBranch: targetBranch,
                // No targetUser — broadcasts are by branch/all
            });

            setSuccess(true);
            setTitle('');
            setMessage('');
            setTargetBranch('all');

            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);
        } catch (err) {
            console.error('Error sending broadcast', err);
            alert('Error al enviar el anuncio.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#18181b] border border-yellow-500/30 rounded-3xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/10 bg-yellow-500/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Enviar Anuncio</h2>
                            <p className="text-xs text-white/40">Solo visible para usuarios master</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center py-10 gap-3 text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-400" />
                            </div>
                            <p className="text-white font-bold text-lg">¡Anuncio enviado!</p>
                            <p className="text-white/40 text-sm">
                                El mensaje fue publicado para{' '}
                                <span className="text-yellow-400 font-semibold">{selectedTarget.label}</span>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSend} className="space-y-4">

                            {/* Destination */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1.5">
                                    Destinatario
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {BROADCAST_TARGETS.map(({ key, label, icon: Icon }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setTargetBranch(key)}
                                            className={clsx(
                                                'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left',
                                                targetBranch === key
                                                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                                                    : 'bg-white/5 border-white/5 text-white/50 hover:border-white/20 hover:text-white/80'
                                            )}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate text-xs">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1.5">
                                    Asunto / Título
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={`Ej: RECORDATORIO — ${targetBranch === 'all' ? 'Todos' : BRANCH_LABELS[targetBranch] ?? targetBranch}`}
                                    required
                                    maxLength={80}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-500/40 outline-none text-sm"
                                />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1.5">
                                    Mensaje
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Escribe aquí el mensaje completo del anuncio..."
                                    required
                                    rows={4}
                                    maxLength={500}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-yellow-500/40 outline-none resize-none text-sm leading-relaxed"
                                />
                                <div className="text-right text-[10px] text-white/25 mt-1">{message.length}/500</div>
                            </div>

                            {/* Preview pill */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                                <Megaphone className="w-3.5 h-3.5 text-yellow-500/60 shrink-0" />
                                <span className="text-xs text-white/40">
                                    Este anuncio aparecerá en el panel de notificaciones de{' '}
                                    <strong className="text-yellow-400/80">
                                        {targetBranch === 'all'
                                            ? 'TODOS los usuarios'
                                            : `la sucursal ${(BRANCH_LABELS[targetBranch] ?? targetBranch).toUpperCase()}`}
                                    </strong>
                                    {' '}con una campana de alerta.
                                </span>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !title.trim() || !message.trim()}
                                className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/30 text-black disabled:text-black/40 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                {loading ? (
                                    'Enviando...'
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Publicar Anuncio
                                        <span className="bg-black/20 rounded-lg px-2 py-0.5 text-[10px]">
                                            {selectedTarget.label}
                                        </span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
