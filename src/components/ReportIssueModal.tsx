import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService, type IssueRecord } from '../services/HistoryService';
import { AlertTriangle, X, Wrench, Settings, ArrowRightLeft, Cpu, Activity, Send } from 'lucide-react';
import clsx from 'clsx';

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const issueTypes = [
    { id: 'damaged_scale', label: 'Daño Físico', desc: 'Golpes, pantalla rota o piezas sueltas.', icon: Wrench },
    { id: 'weight_error', label: 'Error de Precisión', desc: 'Mediciones inestables o desviadas.', icon: ArrowRightLeft },
    { id: 'component_failure', label: 'Fallo de Hardware', desc: 'No enciende o no conecta al PC.', icon: Cpu },
    { id: 'other', label: 'Otro Fallo Operativo', desc: 'Cualquier otro problema técnico.', icon: Settings },
];

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose }) => {
    const [serial, setSerial] = useState('');
    const [model, setModel] = useState('PD-2');
    const [issueType, setIssueType] = useState<'damaged_scale' | 'weight_error' | 'component_failure' | 'other'>('damaged_scale');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await historyService.save({
                model,
                serial,
                branch: 'Central', // hardcoded for demo
                note: description,
                issueType,
                description,
                status: 'en_proceso',
                reportedBy: auth.currentUser?.email || 'Unknown',
            } as IssueRecord, 'issue');

            setSuccess(true);
            setTimeout(() => {
                resetForm();
                onClose();
            }, 3000);
        } catch (error) {
            console.error('Error reporting issue:', error);
            alert('Error al enviar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSerial('');
        setDescription('');
        setIssueType('damaged_scale');
        setSuccess(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-2xl" />

            <div className="relative w-full max-w-3xl bg-[#0a0a0c] border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(239,68,68,0.1)] overflow-hidden flex flex-col max-h-[90vh]">
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="p-8 relative border-b border-white/5 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Reporte de Avería</h2>
                        </div>
                        <p className="text-white/40 text-sm ml-13">El reporte será enviado instantáneamente al equipo técnico.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-white/40 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar relative z-10 flex-1">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-6">
                            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                                <Activity className="w-12 h-12 text-green-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-black text-white tracking-tight">Reporte Recibido</h3>
                                <p className="text-white/50 text-lg">Su petición está <span className="text-purple-400 font-bold">En Proceso</span>. Puede seguir el estado en la pestaña Historial.</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Serial del Equipo (Serie P)</label>
                                    <input
                                        type="text"
                                        value={serial}
                                        onChange={e => setSerial(e.target.value)}
                                        placeholder="Ingrese el SN..."
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none transition-all placeholder:text-white/20 text-lg"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Modelo de Equipo</label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none transition-all text-lg"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Clasificación del Fallo</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {issueTypes.map(type => {
                                        const Icon = type.icon;
                                        const isSelected = issueType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setIssueType(type.id as typeof issueType)}
                                                className={clsx(
                                                    "p-5 rounded-2xl border text-left flex gap-4 transition-all duration-300 group",
                                                    isSelected
                                                        ? "bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                                                        : "bg-[#050505] border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 transition-colors",
                                                    isSelected ? "bg-red-500 text-white" : "bg-white/5 text-white/40 group-hover:text-white/60"
                                                )}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className={clsx("font-bold text-lg mb-1", isSelected ? "text-white" : "text-white/70")}>
                                                        {type.label}
                                                    </div>
                                                    <div className="text-white/30 text-xs leading-relaxed">
                                                        {type.desc}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Detalles de la Anomalía</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none resize-none transition-all placeholder:text-white/20 text-base"
                                    placeholder="Describa el problema detalladamente..."
                                    required
                                />
                            </div>

                            <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-4 rounded-xl text-white/50 font-bold hover:bg-white/5 hover:text-white transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_-10px_rgba(239,68,68,0.5)] flex items-center gap-2"
                                >
                                    {loading ? "PROCESANDO..." : (
                                        <>ENVIAR INFORME TÉCNICO <Send className="w-4 h-4 ml-2" /></>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
