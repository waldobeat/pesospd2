import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService, type IssueRecord } from '../services/HistoryService';
import { notificationService } from '../services/NotificationService';
import {
    X, AlertTriangle, Send, CheckCircle, ChevronDown,
    PackageCheck, Truck, Hash
} from 'lucide-react';
import clsx from 'clsx';

// ── Equipment catalog ─────────────────────────────────────────────────────────
const EQUIPMENT_MODELS = [
    { group: 'Balanza Peso', items: ['PESO - PD-1', 'PESO - PD-2'] },
    { group: 'Balanza Chino', items: ['BALANZA CHINO 15KG', 'BALANZA CHINO 30KG', 'BALANZA CHINO 60KG'] },
    { group: 'Balanza CL', items: ['BALANZA CL5200', 'BALANZA CL3000', 'BALANZA CL7200'] },
    { group: 'Báscula Mostrador', items: ['MOSTRADOR 15KG', 'MOSTRADOR 30KG', 'MOSTRADOR 60KG'] },
    { group: 'Báscula Piso', items: ['BÁSCULA PISO 150KG', 'BÁSCULA PISO 300KG', 'BÁSCULA PISO 500KG', 'BÁSCULA PISO 1000KG'] },
    { group: 'Impresora / Etiquetas', items: ['IMPRESORA DIGI', 'PORTA ETIQUETAS'] },
    { group: 'Otro', items: ['OTRO EQUIPO'] },
];

// ── Shipping checklist ────────────────────────────────────────────────────────
const SHIPPING_ITEMS = [
    { key: 'clean', label: 'El equipo se envió limpio' },
    { key: 'internet', label: 'Cable de internet' },
    { key: 'power', label: 'Cable de poder' },
    { key: 'serial', label: 'Cable serial' },
    { key: 'labelHolder', label: 'Porta etiqueta' },
] as const;

type ShippingKey = typeof SHIPPING_ITEMS[number]['key'];

interface ShippingChecklist {
    clean: boolean;
    internet: boolean;
    power: boolean;
    serial: boolean;
    labelHolder: boolean;
}

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose }) => {
    const [model, setModel] = useState('');
    const [serial, setSerial] = useState('');
    const [issueType, setIssueType] = useState<IssueRecord['issueType']>('weight_error');
    const [description, setDescription] = useState('');
    const [sendToRepair, setSendToRepair] = useState(false);

    // ── Shipping phase fields ──────────────────────────────────────────────
    const [transferCode, setTransferCode] = useState('');
    const [checklist, setChecklist] = useState<ShippingChecklist>({
        clean: false, internet: false, power: false, serial: false, labelHolder: false,
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const ISSUE_LABELS: Record<string, string> = {
        weight_error: 'Error de Peso / Desviación',
        damaged_scale: 'Balanza Dañada (Físico)',
        component_failure: 'Fallo de Componente',
        other: 'Otro',
    };

    const toggleCheck = (key: ShippingKey) => {
        setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!model) { alert('Por favor seleccione un modelo de equipo.'); return; }
        setLoading(true);

        const currentUser = auth.currentUser;
        const userEmail = currentUser?.email ?? 'Usuario';
        const userBranch = userEmail.split('@')[0];

        // Build shipping note if applicable
        const shippingItems = SHIPPING_ITEMS.filter(i => checklist[i.key]).map(i => i.label);
        const shippingNote = sendToRepair
            ? `\n\n📦 ENVIADO AL TALLER\n• Guía/Transferencia: ${transferCode || 'N/A'}\n• Accesorios enviados: ${shippingItems.length ? shippingItems.join(', ') : 'Ninguno marcado'}`
            : '';

        try {
            // 1. Save to history
            await historyService.save({
                model,
                serial,
                branch: userBranch,
                note: description + shippingNote,
                issueType,
                description: description + shippingNote,
                status: sendToRepair ? 'in_repair' : 'open',
                reportedBy: userEmail,
                user: userEmail,
            }, 'issue');

            // 2. Create real-time notification for taller/masters
            await notificationService.create({
                type: 'issue_report',
                title: `Avería Reportada — ${ISSUE_LABELS[issueType] ?? issueType}`,
                message: description + (sendToRepair ? `\n📦 Guía: ${transferCode || 'N/A'} | Enviado al taller` : ''),
                fromUser: userEmail,
                fromBranch: userBranch,
                targetBranch: 'taller',
                relatedSerial: serial,
                relatedModel: model,
            });

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
                resetForm();
            }, 2500);
        } catch (error) {
            console.error('Error reporting issue', error);
            alert('Error al enviar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setModel('');
        setSerial('');
        setDescription('');
        setIssueType('weight_error');
        setSendToRepair(false);
        setTransferCode('');
        setChecklist({ clean: false, internet: false, power: false, serial: false, labelHolder: false });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#18181b] border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/10 bg-red-900/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Reportar Avería / Incidencia
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="p-6 overflow-y-auto flex-1">
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

                            {/* ── Model dropdown ── */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">
                                    Modelo / Tipo de Equipo <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        required
                                        className="w-full appearance-none bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-red-500/50 outline-none pr-10"
                                    >
                                        <option value="" disabled>— Seleccione un equipo —</option>
                                        {EQUIPMENT_MODELS.map((grp) => (
                                            <optgroup key={grp.group} label={grp.group}>
                                                {grp.items.map((item) => (
                                                    <option key={item} value={item}>{item}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                </div>
                            </div>

                            {/* ── Serial ── */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">Número de Serie</label>
                                <input
                                    type="text"
                                    value={serial}
                                    onChange={(e) => setSerial(e.target.value)}
                                    placeholder="SN-XXXX"
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-red-500/50 outline-none"
                                />
                            </div>

                            {/* ── Issue type ── */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">Tipo de Problema</label>
                                <select
                                    value={issueType}
                                    onChange={(e) => setIssueType(e.target.value as IssueRecord['issueType'])}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-red-500/50 outline-none"
                                >
                                    <option value="weight_error">Error de Peso / Desviación</option>
                                    <option value="damaged_scale">Balanza Dañada (Físico)</option>
                                    <option value="component_failure">Fallo de Componente (Pantalla/Teclado)</option>
                                    <option value="other">Otro</option>
                                </select>
                            </div>

                            {/* ── Description ── */}
                            <div>
                                <label className="block text-white/50 text-xs uppercase font-bold mb-1">Descripción del Fallo</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Describa el problema con detalle..."
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-red-500/50 outline-none resize-none"
                                />
                            </div>

                            {/* ── Send to repair toggle ── */}
                            <div
                                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors cursor-pointer"
                                onClick={() => setSendToRepair(!sendToRepair)}
                            >
                                <div className={clsx(
                                    'w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0',
                                    sendToRepair ? 'bg-red-500 border-red-500' : 'border-white/30'
                                )}>
                                    {sendToRepair && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-white flex items-center gap-1.5">
                                        <Truck className="w-4 h-4 text-red-400" />
                                        Marcar 'Enviado a Reparación'
                                    </span>
                                    <span className="block text-xs text-white/40">Indica que el equipo fue enviado al taller</span>
                                </div>
                            </div>

                            {/* ── SHIPPING PHASE (conditional) ── */}
                            {sendToRepair && (
                                <div className="border border-amber-500/30 rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                    {/* Phase header */}
                                    <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
                                        <PackageCheck className="w-4 h-4 text-amber-400" />
                                        <span className="text-amber-300 font-bold text-sm">Datos del Envío al Taller</span>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Transfer number */}
                                        <div>
                                            <label className="block text-white/50 text-xs uppercase font-bold mb-1.5 flex items-center gap-1">
                                                <Hash className="w-3 h-3" />
                                                Número de Transferencia / Guía
                                            </label>
                                            <input
                                                type="text"
                                                value={transferCode}
                                                onChange={(e) => setTransferCode(e.target.value)}
                                                placeholder="Ej: TRF-001, DHL-2024..."
                                                className="w-full bg-black/50 border border-amber-500/20 rounded-xl px-4 py-2.5 text-white focus:border-amber-500/50 outline-none font-mono"
                                            />
                                        </div>

                                        {/* Accessories checklist */}
                                        <div>
                                            <label className="block text-white/50 text-xs uppercase font-bold mb-2">
                                                Accesorios / Condición del Envío
                                            </label>
                                            <div className="space-y-2">
                                                {SHIPPING_ITEMS.map(({ key, label }) => (
                                                    <div
                                                        key={key}
                                                        onClick={() => toggleCheck(key)}
                                                        className={clsx(
                                                            'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                                                            checklist[key]
                                                                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                                                                : 'bg-white/3 border-white/5 text-white/50 hover:border-white/15'
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                                            checklist[key] ? 'bg-green-500 border-green-500' : 'border-white/25'
                                                        )}>
                                                            {checklist[key] && (
                                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                                                    <path d="m1 6 4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-medium">{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Submit ── */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? 'Enviando...' : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        {sendToRepair ? 'Registrar Avería y Envío al Taller' : 'Registrar Avería'}
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
