import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { useAuthRole } from '../hooks/useAuthRole';
import {
    historyService, type HistoryItem, type IssueRecord,
    type InventoryOpRecord, type RepairRecord, type CalibrationRecord
} from '../services/HistoryService';
import {
    X, Trash2, FileText, Search, FileDown, Wrench,
    CheckCircle, AlertTriangle, RefreshCw, ChevronDown,
    ChevronRight, Clock, User, Tag, Hash, MapPin,
    Package, Truck, Thermometer, ClipboardList
} from 'lucide-react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoryViewProps {
    isOpen: boolean;
    onClose: () => void;
}

// ── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
    calibration: { icon: CheckCircle, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'CALIBRACIÓN', border: 'border-cyan-500/20' },
    repair: { icon: Wrench, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'MANTENIMIENTO', border: 'border-blue-500/20' },
    issue: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'REPORTE_FALLA', border: 'border-red-500/20' },
    inventory_op: { icon: RefreshCw, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'OPERACIÓN_LÓGICA', border: 'border-emerald-500/20' },
};

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ record, onClose }: { record: HistoryItem; onClose: () => void }) {
    const meta = TYPE_META[record.type] ?? TYPE_META.calibration;
    const Icon = meta.icon;

    const Field = ({ icon: FieldIcon, label, value }: { icon: React.ElementType; label: string; value?: string | number | boolean | null }) => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                <FieldIcon className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white/40 uppercase font-bold tracking-wide mb-0.5">{label}</div>
                    <div className="text-sm text-white/80 break-words">{String(value)}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-80 shrink-0 flex flex-col border-l border-white/5 bg-slate-900/40 backdrop-blur-xl animate-in slide-in-from-right-2 duration-300">
            {/* Panel header */}
            <div className="relative px-6 py-5 border-b border-white/5 overflow-hidden">
                <div className={clsx('absolute inset-0 opacity-10', meta.bg)} />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border', meta.border, meta.bg)}>
                            <Icon className={clsx('w-4 h-4', meta.color)} />
                        </div>
                        <div>
                            <div className={clsx('text-[10px] font-black uppercase tracking-widest', meta.color)}>{meta.label}</div>
                            <div className="text-white font-black text-xs tracking-tight uppercase">{record.model}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-500 hover:text-white border border-transparent hover:border-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0">
                <Field icon={Hash} label="Número de Serie" value={record.serial} />
                <Field icon={Tag} label="Modelo" value={record.model} />
                <Field icon={MapPin} label="Sucursal" value={record.branch} />
                <Field icon={User} label="Usuario" value={record.user} />
                <Field icon={Clock} label="Fecha y Hora"
                    value={new Date(record.date).toLocaleString('es-VE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                    })} />

                {/* Calibration */}
                {record.type === 'calibration' && (
                    <>
                        <Field icon={Thermometer} label="Peso Final" value={`${(record as CalibrationRecord).finalWeight} kg`} />
                        <Field icon={Thermometer} label="Peso Objetivo" value={`${(record as CalibrationRecord).targetWeight} kg`} />
                        <Field icon={CheckCircle} label="Resultado"
                            value={(record as CalibrationRecord).passed ? '✅ APROBADO' : '❌ FALLIDO'} />
                    </>
                )}

                {/* Repair */}
                {record.type === 'repair' && (
                    <>
                        <Field icon={ClipboardList} label="Diagnóstico" value={(record as RepairRecord).diagnosis} />
                        <Field icon={Wrench} label="Solución" value={(record as RepairRecord).solution} />
                        <Field icon={CheckCircle} label="Estado"
                            value={(record as RepairRecord).repaired ? '✅ Reparado' : '⏳ Pendiente'} />
                    </>
                )}

                {/* Issue */}
                {record.type === 'issue' && (
                    <>
                        <Field icon={AlertTriangle} label="Tipo de Fallo"
                            value={{
                                weight_error: 'Error de Peso / Desviación',
                                damaged_scale: 'Balanza Dañada (Físico)',
                                component_failure: 'Fallo de Componente',
                                other: 'Otro',
                            }[(record as IssueRecord).issueType] ?? (record as IssueRecord).issueType} />
                        <Field icon={ClipboardList} label="Descripción" value={(record as IssueRecord).description} />
                        <Field icon={User} label="Reportado por" value={(record as IssueRecord).reportedBy} />
                        <Field icon={RefreshCw} label="Estado"
                            value={{
                                open: '🔴 Abierto',
                                in_repair: '🟠 En Taller',
                                resolved: '🟢 Resuelto',
                            }[record.status] ?? record.status} />
                    </>
                )}

                {/* Inventory Op */}
                {record.type === 'inventory_op' && (
                    <>
                        <Field icon={Package} label="Estado Aplicado" value={(record as InventoryOpRecord).status} />
                        <Field icon={Truck} label="Destino" value={(record as InventoryOpRecord).destination} />
                        <Field icon={User} label="Actualizado por" value={(record as InventoryOpRecord).updatedBy} />
                    </>
                )}

                {/* Common note */}
                {record.note && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-[11px] text-white/40 uppercase font-bold tracking-wide mb-1.5 flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5" /> Nota
                        </div>
                        <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{record.note}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export const HistoryView: React.FC<HistoryViewProps> = ({ isOpen, onClose }) => {
    const [records, setRecords] = useState<HistoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'' | 'calibration' | 'repair' | 'issue' | 'inventory_op'>('');
    const [loading, setLoading] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<HistoryItem | null>(null);

    const { isAdmin } = useAuthRole(auth.currentUser);

    useEffect(() => {
        if (isOpen) loadRecords();
    }, [isOpen, isAdmin]);

    const loadRecords = async () => {
        setLoading(true);
        const userEmail = auth.currentUser?.email || '';
        const data = await historyService.getAll(userEmail, isAdmin);
        setRecords(data);
        setLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('¿Está seguro de eliminar este registro?')) {
            await historyService.delete(id);
            if (selectedRecord?.id === id) setSelectedRecord(null);
            loadRecords();
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18); doc.setTextColor(41, 128, 185);
        doc.text('REPORTE GENERAL DE OPERACIONES', 105, 20, { align: 'center' });
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text('Sistema de Pesaje Certificado (SISDEPE) - Central Luxor', 105, 28, { align: 'center' });
        doc.setFontSize(9); doc.setTextColor(60);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 195, 15, { align: 'right' });
        doc.text(`Total Registros: ${filteredRecords.length}`, 195, 20, { align: 'right' });

        const tableBody = filteredRecords.map((r) => {
            let status = ''; let detail = '';
            if (r.type === 'repair') { status = r.repaired ? 'Reparado' : 'Pendiente'; detail = r.diagnosis; }
            else if (r.type === 'issue') { status = r.status === 'resolved' ? 'Resuelto' : r.status === 'in_repair' ? 'En Taller' : 'Abierto'; detail = r.description; }
            else if (r.type === 'inventory_op') { const op = r as InventoryOpRecord; status = op.status; detail = op.destination ? `Destino: ${op.destination}` : ''; }
            else { status = r.passed ? 'Aprobado' : 'Fallido'; detail = `${r.finalWeight} / ${r.targetWeight} kg`; }
            return [new Date(r.date).toLocaleDateString(), TYPE_META[r.type]?.label ?? r.type, r.user ?? 'N/A', r.model, r.serial, r.branch ?? 'N/A', status, detail];
        });

        autoTable(doc, {
            startY: 35,
            head: [['Fecha', 'Tipo', 'Usuario', 'Modelo', 'Serial', 'Sucursal', 'Estado', 'Detalle']],
            body: tableBody, theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] }, styles: { fontSize: 7 },
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - SISDEPE`, 105, 290, { align: 'center' });
        }
        doc.save(`Reporte_Operaciones_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const filteredRecords = records.filter((r) => {
        const matchType = !typeFilter || r.type === typeFilter;
        const matchSearch = !searchTerm || [
            r.serial, r.model, r.note, r.user ?? '',
            r.type === 'repair' ? (r as RepairRecord).diagnosis + ' ' + (r as RepairRecord).solution : '',
            r.type === 'issue' ? (r as IssueRecord).description : '',
        ].some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchType && matchSearch;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-500">
            <div className="relative w-full max-w-7xl h-[85vh] group">
                {/* Outer Glow */}
                <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative h-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="relative p-8 border-b border-white/5 flex justify-between items-center shrink-0">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                                <FileText className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight leading-none uppercase">
                                    HISTORIAL DE OPERACIONES
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                    REGISTRO GENERAL // LOG_AUDITORÍA
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportPDF}
                                className="h-11 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 rounded-2xl font-black text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95"
                            >
                                <FileDown className="w-4 h-4 text-cyan-400" />
                                EXPORTAR_PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="h-11 w-11 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-500 hover:text-white transition-all active:scale-95"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="px-8 py-4 bg-slate-950/20 border-b border-white/5 flex gap-4 shrink-0">
                        {/* Search */}
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="SERIAL // MODELO // TÉCNICO..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/10 text-xs font-bold tracking-widest uppercase transition-all"
                            />
                        </div>
                        {/* Type filter */}
                        <div className="relative">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                                className="appearance-none bg-slate-900 border border-white/5 rounded-2xl px-6 py-3.5 text-slate-400 outline-none focus:border-cyan-500/30 text-[10px] font-black tracking-[0.2em] uppercase pr-10 hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <option value="">TODOS_LOS_EVENTOS</option>
                                <option value="calibration">CALIBRACIÓN</option>
                                <option value="repair">MANTENIMIENTO</option>
                                <option value="issue">FALLAS</option>
                                <option value="inventory_op">OPERACIONES_LÓGICAS</option>
                            </select>
                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                        </div>
                    </div>

                    {/* Content area: table + detail panel */}
                    <div className="flex flex-1 overflow-hidden min-h-0">

                        {/* Table */}
                        <div className="flex-1 overflow-x-auto overflow-y-auto bg-black/40 relative">
                            {loading && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white text-sm">
                                    Cargando...
                                </div>
                            )}
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-slate-950/40 sticky top-0 backdrop-blur-md z-10 border-b border-white/5">
                                    <tr>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-14">REF</th>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha / Hora</th>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operador</th>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">ID_Hardware</th>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">ESTADO_ACTUAL</th>
                                        <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">NOTAS_OPERACIÓN</th>
                                        <th className="p-5 text-center w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-white/20 text-sm">
                                                {loading ? '...' : 'No hay registros encontrados.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record) => {
                                            const meta = TYPE_META[record.type] ?? TYPE_META.calibration;
                                            const Icon = meta.icon;
                                            const isSelected = selectedRecord?.id === record.id;

                                            // Summary text
                                            let summary = record.note || '';
                                            if (record.type === 'repair') summary = (record as RepairRecord).diagnosis;
                                            if (record.type === 'issue') summary = (record as IssueRecord).description;
                                            if (record.type === 'inventory_op' && (record as InventoryOpRecord).destination)
                                                summary = `→ ${(record as InventoryOpRecord).destination}`;

                                            // Status badge
                                            let statusBadge = null;
                                            if (record.type === 'calibration') {
                                                statusBadge = (
                                                    <div className={clsx('inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase',
                                                        record.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
                                                        <span className={clsx('w-1 h-1 rounded-full mr-2', record.passed ? 'bg-emerald-400' : 'bg-red-400')} />
                                                        {record.passed ? 'APROBADO' : 'FALLIDO'}
                                                    </div>
                                                );
                                            } else if (record.type === 'repair') {
                                                const rep = (record as RepairRecord).repaired;
                                                statusBadge = (
                                                    <div className={clsx('inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase',
                                                        rep ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20')}>
                                                        <span className={clsx('w-1 h-1 rounded-full mr-2', rep ? 'bg-blue-400' : 'bg-yellow-400')} />
                                                        {rep ? 'RESTAURADO' : 'EN_PROCESO'}
                                                    </div>
                                                );
                                            } else if (record.type === 'issue') {
                                                const st = (record as IssueRecord).status;
                                                statusBadge = (
                                                    <div className={clsx('inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black tracking-widest uppercase',
                                                        st === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            st === 'in_repair' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
                                                        <span className={clsx('w-1 h-1 rounded-full mr-2', st === 'resolved' ? 'bg-emerald-400' : st === 'in_repair' ? 'bg-orange-400' : 'bg-red-400')} />
                                                        {st.toUpperCase()}
                                                    </div>
                                                );
                                            } else {
                                                statusBadge = (
                                                    <div className="inline-flex items-center px-3 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-black tracking-widest uppercase">
                                                        {(record as InventoryOpRecord).status}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <tr
                                                    key={record.id}
                                                    onClick={() => setSelectedRecord(isSelected ? null : record)}
                                                    className={clsx(
                                                        'transition-colors cursor-pointer group',
                                                        isSelected ? 'bg-white/10 border-l-2 border-l-blue-500' : 'hover:bg-white/5'
                                                    )}
                                                >
                                                    <td className="p-5">
                                                        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-300',
                                                            isSelected ? 'bg-white/10 border-white/20' : 'bg-slate-900 border-white/5 group-hover:bg-slate-800')}>
                                                            <Icon className={clsx('w-4 h-4', meta.color)} />
                                                        </div>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="p-5">
                                                        <div className="text-[11px] font-black text-white/80 tracking-tight">{new Date(record.date).toLocaleDateString('es-VE')}</div>
                                                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">{new Date(record.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>

                                                    {/* User */}
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 bg-slate-800 rounded-md flex items-center justify-center border border-white/5">
                                                                <User className="w-2.5 h-2.5 text-slate-400" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-black text-white truncate uppercase tracking-tighter">{record.user?.split('@')[0] ?? 'N/A'}</div>
                                                                <div className="text-[9px] font-bold text-cyan-500/50 truncate uppercase tracking-widest">{record.branch ?? 'DESCONOCIDO'}</div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Model / Serial */}
                                                    <td className="p-5">
                                                        <div className="text-[11px] font-black text-white uppercase tracking-tight">{record.model}</div>
                                                        <div className="text-[10px] font-bold text-slate-500 mt-0.5 font-mono tracking-widest">{record.serial}</div>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="p-5">{statusBadge}</td>

                                                    {/* Summary */}
                                                    <td className="p-5 min-w-[200px]">
                                                        <div className="text-[11px] font-bold text-slate-400 line-clamp-2 leading-relaxed italic">{summary}</div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="p-5 text-center">
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedRecord(isSelected ? null : record); }}
                                                                className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all border border-transparent hover:border-white/10"
                                                            >
                                                                <ChevronRight className="w-4 h-4" />
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={(e) => handleDelete(record.id, e)}
                                                                    className="p-2 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Detail panel */}
                        {selectedRecord && (
                            <DetailPanel record={selectedRecord} onClose={() => setSelectedRecord(null)} />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 bg-slate-950/40 border-t border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            <RefreshCw className="w-3 h-3 animate-spin-slow" />
                            LIVE_STREAM // DB_CONECTADA
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            SELECCIONE_ENTRADA_PARA_VER_TELEMETRÍA
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
```
