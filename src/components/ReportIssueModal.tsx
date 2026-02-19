import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService, type IssueRecord } from '../services/HistoryService';
import { X, AlertTriangle, Send, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose }) => {
    const [model, setModel] = useState("PD-2");
    const [serial, setSerial] = useState("");
    const [issueType, setIssueType] = useState<IssueRecord['issueType']>('weight_error');
    const [description, setDescription] = useState("");
    const [sendToRepair, setSendToRepair] = useState(false);

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await historyService.save({
                model,
                serial,
                branch: "Central", // Could be dynamic
                note: description, // Mapping description to note for BaseRecord compatibility
                issueType,
                description,
                status: sendToRepair ? 'in_repair' : 'open',
                reportedBy: auth.currentUser?.email || "Usuario Estándar"
            }, 'issue');

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
                resetForm();
            }, 2000);
        } catch (error) {
            console.error("Error reporting issue", error);
            alert("Error al enviar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setModel("PD-2");
        setSerial("");
        setDescription("");
        setIssueType('weight_error');
        setSendToRepair(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#18181b] border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-red-900/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Reportar Avería / Incidencia
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">¡Reporte Enviado!</h3>
                            <p className="text-white/50">El equipo técnico ha sido notificado.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white/50 text-xs uppercase font-bold mb-1">Modelo</label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-red-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/50 text-xs uppercase font-bold mb-1">Serial</label>
                                    <input
                                        type="text"
                                        value={serial}
                                        onChange={e => setSerial(e.target.value)}
                                        placeholder="SN-XXXX"
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-red-500/50 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">Tipo de Problema</label>
                                <select
                                    value={issueType}
                                    onChange={(e) => setIssueType(e.target.value as any)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-red-500/50 outline-none"
                                >
                                    <option value="weight_error">Error de Peso / Desviación</option>
                                    <option value="damaged_scale">Balanza Dañada (Físico)</option>
                                    <option value="component_failure">Fallo de Componente (Pantalla/Teclado)</option>
                                    <option value="other">Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">Descripción del Fallo</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    placeholder="Describa el problema con detalle..."
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-red-500/50 outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer" onClick={() => setSendToRepair(!sendToRepair)}>
                                <div className={clsx(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                    sendToRepair ? "bg-red-500 border-red-500" : "border-white/30"
                                )}>
                                    {sendToRepair && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-white">Marcar 'Enviado a Reparación'</span>
                                    <span className="block text-xs text-white/40">Cambia el estado inmediato a reparación</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 mt-4"
                            >
                                {loading ? "Enviando..." : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Registrar Avería
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
