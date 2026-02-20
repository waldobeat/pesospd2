import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService } from '../services/HistoryService';
import { X, ArchiveX, ShieldAlert, CheckCircle } from 'lucide-react';

interface DecommissionModuleProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DecommissionModule: React.FC<DecommissionModuleProps> = ({ isOpen, onClose }) => {
    const [model, setModel] = useState("PD-2");
    const [serial, setSerial] = useState("");
    const [reason, setReason] = useState("");

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await historyService.save({
                model,
                serial,
                branch: "Central",
                note: `BAJA DE EQUIPO: ${reason}`,
                issueType: 'other',
                description: "Equipo dado de baja y removido del inventario activo.",
                status: 'dado_de_baja',
                reportedBy: auth.currentUser?.email || "Admin",
                user: auth.currentUser?.email || "Admin",
                diagnostic: "Inspección Final de Baja",
                solution: "Retiro Definitivo",
                adminMessage: "Equipo dado de baja permanentemente del inventario.",
            }, 'issue'); // Stored as issue type but flagged decommissioned

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);
        } catch (error) {
            console.error("Error decommissioning", error);
            alert("Error al dar de baja.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/90 backdrop-blur-xl" />

            <div className="relative w-full max-w-lg bg-[#0a0a0c] border border-red-500/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />

                {/* Header */}
                <div className="p-6 relative border-b border-white/5 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <ArchiveX className="w-5 h-5 text-red-500" />
                        </div>
                        Dar de Baja Equipo
                    </h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 relative z-10">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-2 animate-bounce">
                                <CheckCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Equipo Retirado</h3>
                            <p className="text-white/50">El equipo ha sido registrado como Dado de Baja en el historial histórico.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex gap-4 text-orange-400">
                                <ShieldAlert className="w-6 h-6 shrink-0" />
                                <p className="text-sm">Esta acción marcará el equipo inmediatamente como irrecuperable en el historial maestro.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-white/50 text-[10px] uppercase tracking-widest font-bold mb-2">Modelo</label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-red-500/50 focus:bg-white/5 outline-none transition-all placeholder:text-white/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/50 text-[10px] uppercase tracking-widest font-bold mb-2">Serial del Equipo</label>
                                    <input
                                        type="text"
                                        value={serial}
                                        onChange={e => setSerial(e.target.value)}
                                        placeholder="Ingrese el número de serie completo"
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-red-500/50 focus:bg-white/5 outline-none transition-all placeholder:text-white/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/50 text-[10px] uppercase tracking-widest font-bold mb-2">Motivo de Baja / Condición</label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        rows={3}
                                        placeholder="Ej: Placa madre incinerada, corrosión excesiva..."
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-red-500/50 focus:bg-white/5 outline-none resize-none transition-all placeholder:text-white/20"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_-10px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2 group mt-8"
                            >
                                {loading ? "Procesando..." : (
                                    <>
                                        Confirmar Baja Definitiva
                                        <ArchiveX className="w-5 h-5 group-hover:scale-110 transition-transform" />
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
