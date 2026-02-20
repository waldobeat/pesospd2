import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { historyService, type IssueRecord } from '../services/HistoryService';
import { Truck, CheckCircle2, Bell, X } from 'lucide-react';

interface UserNotificationsModalProps {
    isAdmin: boolean;
}

export const UserNotificationsModal: React.FC<UserNotificationsModalProps> = ({ isAdmin }) => {
    const [pendingReceipts, setPendingReceipts] = useState<IssueRecord[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchPending = async () => {
            if (!auth.currentUser) return;

            const records = await historyService.getAll(auth.currentUser.email || "", isAdmin);
            const pending = records.filter(r => r.type === 'issue' && r.status === 'enviado_a_sucursal') as IssueRecord[];

            if (!isAdmin) {
                const userPending = pending.filter(p => p.user === auth.currentUser?.email);
                setPendingReceipts(userPending);
                if (userPending.length > 0) setIsOpen(true);
            } else {
                setPendingReceipts(pending);
                if (pending.length > 0) setIsOpen(true);
            }
        };

        fetchPending();
        const interval = setInterval(fetchPending, 30000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    const handleConfirmReceipt = async (id: string) => {
        if (confirm("Al confirmar, está declarando que ha recibido el equipo físicamente en su sucursal. ¿Proceder?")) {
            await historyService.update(id, { status: 'recibido_en_sucursal' });
            setPendingReceipts(prev => prev.filter(p => p.id !== id));
            if (pendingReceipts.length <= 1) setIsOpen(false);
        }
    };

    if (!isOpen || pendingReceipts.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-3xl" />

            <div className="relative w-full max-w-2xl bg-gradient-to-br from-indigo-900/40 to-[#0a0a0c] border border-indigo-500/30 rounded-[32px] shadow-[0_0_100px_rgba(79,70,229,0.2)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

                <div className="p-8 relative border-b border-indigo-500/20 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                                <Bell className="w-6 h-6 text-indigo-400 animate-pulse" />
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tight">Centro de Avisos</h2>
                        </div>
                        <p className="text-indigo-200/60 text-sm ml-15">
                            {isAdmin ? "Hay equipos enviados a sucursales pendientes de confirmación." : "Tiene equipos reparados en tránsito. Por favor confirme su recepción."}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-white/40 hover:text-white"
                        title="Ocultar Notificaciones"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar relative z-10 flex flex-col gap-4">
                    {pendingReceipts.map(receipt => (
                        <div key={receipt.id} className="bg-black/60 border border-indigo-500/20 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                        <Truck className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <div className="font-black text-white text-xl">{receipt.model}</div>
                                        <div className="text-white/50 font-mono text-sm tracking-widest">{receipt.serial}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Guía / Envío</div>
                                    <div className="text-cyan-300 font-mono font-bold bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">{receipt.trackingNumber || 'PENDIENTE'}</div>
                                </div>
                            </div>

                            {receipt.adminMessage && (
                                <div className="text-sm text-indigo-200/90 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 my-2">
                                    <span className="font-black uppercase text-[10px] tracking-widest text-indigo-400 block mb-1">Mensaje de Taller</span>
                                    {receipt.adminMessage}
                                </div>
                            )}

                            {!isAdmin && (
                                <button
                                    onClick={() => receipt.id && handleConfirmReceipt(receipt.id)}
                                    className="mt-2 w-full py-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/40 hover:to-emerald-600/40 text-green-400 border border-green-500/30 rounded-xl text-sm font-black tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.1)] group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    CONFIRMAR RECEPCIÓN FÍSICA
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
