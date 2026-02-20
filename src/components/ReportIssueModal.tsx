import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService, type IssueRecord } from '../services/HistoryService';
import { AlertTriangle, X, Wrench, Settings, ArrowRightLeft, Cpu, Activity, Send } from 'lucide-react';
import clsx from 'clsx';
import jsPDF from 'jspdf';

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
    const [branch, setBranch] = useState('');
    const [sentToWorkshop, setSentToWorkshop] = useState<boolean | null>(null);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const generatePDF = (reportStatus: string) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(192, 57, 43); // Red
        doc.text("TICKET DE AVERÍA", 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text("Sistema de Pesaje Certificado - Central Luxor", 105, 30, { align: 'center' });

        // Content Box
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.rect(15, 40, 180, 100);

        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Fecha de Reporte: ${new Date().toLocaleString()}`, 20, 50);
        doc.text(`Reportado por: ${auth.currentUser?.email || 'Desconocido'}`, 20, 57);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`Modelo: ${model}`, 20, 70);
        doc.text(`Número de Serie: ${serial}`, 100, 70);
        doc.text(`Sucursal: ${branch}`, 20, 80);

        const selectedIssue = issueTypes.find(t => t.id === issueType)?.label || issueType;
        doc.text(`Falla Reportada: ${selectedIssue}`, 20, 95);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitDesc = doc.splitTextToSize(`Detalles: ${description}`, 170);
        doc.text(splitDesc, 20, 105);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(192, 57, 43);
        doc.text(`Estado del Equipo: ${reportStatus === 'enviado_a_taller' ? 'ENVIADO A TALLER' : 'RETIENEN SUCURSAL'}`, 105, 130, { align: 'center' });

        // Instruction Box
        doc.setFillColor(255, 240, 240);
        doc.rect(15, 150, 180, 40, 'F');
        doc.setFontSize(12);
        doc.setTextColor(192, 0, 0);
        doc.text("INSTRUCCIÓN IMPORTANTE PARA ENVÍO", 105, 160, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text("Recuerde enviar este soporte impreso y firmado junto con el equipo físico en la valija.", 105, 170, { align: 'center' });
        doc.text("Si no adjunta este documento, el ingreso a taller sufrirá demoras operativas.", 105, 177, { align: 'center' });

        // Signatures
        doc.setTextColor(0);
        doc.text("__________________________", 50, 230, { align: 'center' });
        doc.text("Firma Sucursal Emisora", 50, 238, { align: 'center' });

        doc.text("__________________________", 160, 230, { align: 'center' });
        doc.text("Recibido Taller (Sello)", 160, 238, { align: 'center' });

        doc.save(`Ticket_Averia_${serial}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!branch) {
            alert("Por favor indique la sucursal.");
            setLoading(false);
            return;
        }

        if (sentToWorkshop === null) {
            alert("Por favor indique si el equipo ya fue enviado al taller.");
            setLoading(false);
            return;
        }

        try {
            const initialStatus = sentToWorkshop ? 'enviado_a_taller' : 'pendiente_envio';

            await historyService.save({
                model,
                serial,
                branch,
                note: description,
                issueType,
                description,
                status: initialStatus,
                reportedBy: auth.currentUser?.email || 'Unknown',
            } as IssueRecord, 'issue');

            generatePDF(initialStatus);

            setSuccess(true);
            setTimeout(() => {
                resetForm();
                onClose();
            }, 6000);
        } catch (error) {
            console.error('Error reporting issue:', error);
            alert('Error al enviar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSerial('');
        setBranch('');
        setSentToWorkshop(null);
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
                            <div className="text-center space-y-3">
                                <h3 className="text-3xl font-black text-white tracking-tight">Reporte Enviado</h3>
                                <p className="text-white/50 text-lg max-w-md mx-auto">
                                    Su ticket fue enviado y se le notificará al recibirse en el taller.
                                </p>
                                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-sm mx-auto">
                                    <p className="text-red-400 text-sm font-bold">
                                        Se ha generado un PDF automáticamente. OBLIGATORIO enviarlo impreso junto al equipo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Serial del Equipo (Serie P) <span className="text-red-500">*</span></label>
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
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Modelo de Equipo <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none transition-all text-lg"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Sucursal Origen <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={branch}
                                        onChange={e => setBranch(e.target.value)}
                                        placeholder="EJ: C.C. Las Americas"
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none transition-all placeholder:text-white/20 text-lg"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Clasificación del Fallo <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {issueTypes.map(type => {
                                        const Icon = type.icon;
                                        const isSelected = issueType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setIssueType(type.id as typeof issueType)}
                                                className={clsx(
                                                    "p-4 rounded-2xl border text-left flex flex-col gap-3 transition-all duration-300 group",
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
                                                    <div className={clsx("font-bold text-base mb-1", isSelected ? "text-white" : "text-white/70")}>
                                                        {type.label}
                                                    </div>
                                                    <div className="text-white/30 text-[10px] leading-relaxed">
                                                        {type.desc}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Detalles de la Anomalía <span className="text-red-500">*</span></label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500/50 outline-none resize-none transition-all placeholder:text-white/20 text-base"
                                    placeholder="Describa el problema detalladamente..."
                                    required
                                />
                            </div>

                            <div className="space-y-3 bg-[#050505] border border-white/5 p-6 rounded-2xl">
                                <label className="text-[11px] font-black tracking-widest text-white/70 uppercase mb-2 block">
                                    ¿El equipo fue enviado a taller mediante valija / encomienda? <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setSentToWorkshop(true)}
                                        className={clsx(
                                            "flex-1 py-3 px-4 rounded-xl font-bold border transition-all flex items-center justify-center gap-2",
                                            sentToWorkshop === true
                                                ? "bg-green-500/20 border-green-500/50 text-green-400"
                                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        SÍ, FUE ENVIADO HOY
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSentToWorkshop(false)}
                                        className={clsx(
                                            "flex-1 py-3 px-4 rounded-xl font-bold border transition-all flex items-center justify-center gap-2",
                                            sentToWorkshop === false
                                                ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        NO, AÚN RETENIDO AQUÍ
                                    </button>
                                </div>
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
