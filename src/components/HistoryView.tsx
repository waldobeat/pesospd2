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

const TYPE_META = {
    calibration: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Calibración', border: 'border-blue-500/30' },
    repair: { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Reparación', border: 'border-orange-500/30' },
    issue: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Avería', border: 'border-red-500/30' },
    inventory_op: { icon: RefreshCw, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Op. Inventario', border: 'border-purple-500/30' },
};

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
        <div className="w-80 shrink-0 flex flex-col border-l border-white/10 bg-black/30 animate-in slide-in-from-right-2 duration-200">
            <div className={clsx('px-5 py-4 border-b border-white/10 flex items-center justify-between', meta.bg + '/30')}>
                <div className="flex items-center gap-2">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
                        <Icon className={clsx('w-3.5 h-3.5', meta.color)} />
                    </div>
                    <div>
                        <div className={clsx('text-xs font-bold', meta.color)}>{meta.label}</div>
                        <div className="text-white font-semibold text-sm">{record.model}</div>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                </button>
            </div>

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

                {record.type === 'calibration' && (
                    <>
                        <Field icon={Thermometer} label="Peso Final" value={`${(record as CalibrationRecord).finalWeight} kg`} />
                        <Field icon={Thermometer} label="Peso Objetivo" value={`${(record as CalibrationRecord).targetWeight} kg`} />
                        <Field icon={CheckCircle} label="Resultado"
                            value={(record as CalibrationRecord).passed ? '✓ APROBADO' : '✕ FALLIDO'} />
                    </>
                )}

                {record.type === 'repair' && (
                    <>
                        <Field icon={ClipboardList} label="Diagnóstico" value={(record as RepairRecord).diagnosis} />
                        <Field icon={Wrench} label="Solución" value={(record as RepairRecord).solution} />
                        <Field icon={CheckCircle} label="Estado"
                            value={(record as RepairRecord).repaired ? '✓ Reparado' : '⌛ Pendiente'} />
                    </>
                )}

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
                                in_repair: '🛠️ En Taller',
                                resolved: '🟢 Resuelto',
                            }[(record as IssueRecord).status] ?? (record as IssueRecord).status} />
                    </>
                )}

                {record.type === 'inventory_op' && (
                    <>
                        <Field icon={Package} label="Estado Aplicado" value={(record as InventoryOpRecord).status} />
                        <Field icon={Truck} label="Destino" value={(record as InventoryOpRecord).destination} />
                        <Field icon={User} label="Actualizado por" value={(record as InventoryOpRecord).updatedBy} />
                    </>
                )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full max-w-7xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" /> Historial de Operaciones
                        </h2>
                        <p className="text-white/40 text-xs mt-0.5">Registro unificado · {filteredRecords.length} registros</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPDF} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-colors text-xs font-bold flex items-center gap-1.5">
                            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="px-4 py-3 border-b border-white/10 bg-black/20 flex gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            placeholder="Buscar por serial, modelo, nota..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500/50 text-sm"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                            className="appearance-none bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white/70 outline-none focus:border-blue-500/50 text-sm pr-8"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="calibration">Calibraciones</option>
                            <option value="repair">Reparaciones</option>
                            <option value="issue">Averías</option>
                            <option value="inventory_op">Operaciones Inv.</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden min-h-0">
                    <div className="flex-1 overflow-x-auto overflow-y-auto bg-black/40 relative">
                        {loading && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white text-sm">Cargando...</div>}
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider w-10"></th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Fecha</th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Usuario</th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Modelo / Serial</th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Estado</th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">Resumen</th>
                                    <th className="p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredRecords.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-white/20 text-sm">{loading ? '...' : 'No hay registros encontrados.'}</td></tr>
                                ) : (
                                    filteredRecords.map((record) => {
                                        const meta = TYPE_META[record.type] ?? TYPE_META.calibration;
                                        const Icon = meta.icon;
                                        const isSelected = selectedRecord?.id === record.id;
                                        let summary = record.note || '';
                                        if (record.type === 'repair') summary = (record as RepairRecord).diagnosis;
                                        if (record.type === 'issue') summary = (record as IssueRecord).description;
                                        if (record.type === 'inventory_op' && (record as InventoryOpRecord).destination)
                                            summary = `→ ${(record as InventoryOpRecord).destination}`;
                                        let statusBadge = null;
                                        if (record.type === 'calibration') statusBadge = <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold border', record.passed ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>{record.passed ? 'Aprobado' : 'Fallido'}</span>;
                                        else if (record.type === 'repair') statusBadge = <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold border', (record as RepairRecord).repaired ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20')}>{(record as RepairRecord).repaired ? 'Reparado' : 'Pendiente'}</span>;
                                        else if (record.type === 'issue') {
                                            const st = (record as IssueRecord).status;
                                            statusBadge = <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold border', st === 'resolved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : st === 'in_repair' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>{st === 'resolved' ? 'Resuelto' : st === 'in_repair' ? 'En Taller' : 'Abierto'}</span>;
                                        } else statusBadge = <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-purple-500/10 text-purple-400 border-purple-500/20">{(record as InventoryOpRecord).status}</span>;
                                        return (
                                            <tr key={record.id} onClick={() => setSelectedRecord(isSelected ? null : record)} className={clsx('transition-colors cursor-pointer group', isSelected ? 'bg-white/10 border-l-2 border-l-blue-500' : 'hover:bg-white/5')}>
                                                <td className="p-3 px-4"><div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', meta.bg)}><Icon className={clsx('w-3.5 h-3.5', meta.color)} /></div></td>
                                                <td className="p-3 px-4 text-white/60 text-xs whitespace-nowrap"><div>{new Date(record.date).toLocaleDateString('es-VE')}</div><div className="text-white/30">{new Date(record.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div></td>
                                                <td className="p-3 px-4 max-w-[130px]"><div className="text-xs font-medium text-white/70 truncate">{record.user?.split('@')[0] ?? 'N/A'}</div><div className="text-[10px] text-white/30 truncate">{record.branch ?? ''}</div></td>
                                                <td className="p-3 px-4"><div className="font-bold text-white text-sm">{record.model}</div><div className="text-xs text-white/40 font-mono">{record.serial}</div></td>
                                                <td className="p-3 px-4">{statusBadge}</td>
                                                <td className="p-3 px-4 max-w-[200px]"><div className="text-xs text-white/50 truncate">{summary}</div></td>
                                                <td className="p-3 px-4 text-center">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedRecord(isSelected ? null : record); }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-colors" title="Ver detalles"><ChevronRight className="w-3.5 h-3.5" /></button>
                                                        {isAdmin && <button onClick={(e) => handleDelete(record.id, e)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/20 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {selectedRecord && <DetailPanel record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
                </div>
                <div className="px-5 py-2.5 bg-white/5 border-t border-white/10 text-center text-[11px] text-white/20 shrink-0">Sincronizado con Firebase Cloud · Haz clic en una fila para ver detalles completos</div>
            </div>
        </div>
    );
};
