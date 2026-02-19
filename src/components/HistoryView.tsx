import { auth } from '../firebase';
import { useAuthRole } from '../hooks/useAuthRole';
import { historyService, type HistoryItem } from '../services/HistoryService';
import { X, Trash2, FileText, Search, FileDown, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoryViewProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ isOpen, onClose }) => {
    const [records, setRecords] = useState<HistoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadRecords();
        }
    }, [isOpen]);

    const loadRecords = async () => {
        setLoading(true);
        const data = await historyService.getAll();
        setRecords(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Está seguro de eliminar este registro?")) {
            await historyService.delete(id);
            loadRecords(); // Reload after delete
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Header
        const title = "REPORTE GENERAL DE OPERACIONES";
        const subtitle = "Sistema de Pesaje Certificado (SISDEPE) - Central Luxor";

        doc.setFontSize(18);
        doc.setTextColor(41, 128, 185);
        doc.text(title, 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(subtitle, 105, 28, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 195, 15, { align: 'right' });
        doc.text(`Total Registros: ${filteredRecords.length}`, 195, 20, { align: 'right' });

        // Table
        const tableBody = filteredRecords.map(r => {
            let status = "";
            let detail = "";

            if (r.type === 'repair') {
                status = r.repaired ? "Reparado" : "Pendiente";
                detail = r.diagnosis;
            } else {
                status = r.passed ? "Aprobado" : "Fallido";
                detail = `${r.finalWeight} / ${r.targetWeight} kg`;
            }

            return [
                new Date(r.date).toLocaleDateString(),
                r.type === 'repair' ? 'Reparación' : 'Calibración',
                r.model,
                r.serial,
                r.branch || "N/A",
                status,
                detail
            ];
        });

        autoTable(doc, {
            startY: 35,
            head: [['Fecha', 'Tipo', 'Modelo', 'Serial', 'Sucursal', 'Estado', 'Detalle']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 },
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount} - Generado por SISDEPE`, 105, 290, { align: 'center' });
        }

        doc.save(`Reporte_Operaciones_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const filteredRecords = records.filter(r =>
        r.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.note.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.type === 'repair' && (r.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) || r.solution.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full max-w-6xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-400" />
                            Historial de Operaciones
                        </h2>
                        <p className="text-white/40 text-sm mt-1">
                            Registro unificado de Calibraciones y Reparaciones
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportPDF}
                            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-colors text-sm font-bold flex items-center gap-2"
                            title="Generar reporte en PDF"
                        >
                            <FileDown className="w-4 h-4" />
                            Generar Reporte PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-white/10 bg-black/20 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            placeholder="Buscar por Serial, Modelo, Nota o Diagnóstico..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div className="flex items-center text-white/40 text-sm font-mono px-2">
                        {filteredRecords.length} Registros
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto overflow-y-auto bg-black/40 flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white">
                            Cargando historial...
                        </div>
                    )}
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
                            <tr>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider w-[120px]">Tipo</th>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider w-[150px]">Fecha</th>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Modelo / Serial</th>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Resultado / Estado</th>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Detalles</th>
                                <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-center w-[80px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-white/20">
                                        {loading ? "..." : "No hay registros encontrados."}
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 px-6">
                                            {record.type === 'repair' ? (
                                                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400" title="Reparación Manual">
                                                    <Wrench className="w-4 h-4" />
                                                </div>
                                            ) : record.type === 'issue' ? (
                                                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400" title="Avería Reportada">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400" title="Calibración">
                                                    <CheckCircle className="w-4 h-4" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-white/60 font-mono text-sm whitespace-nowrap">
                                            {new Date(record.date).toLocaleDateString()}
                                            <span className="block text-xs text-white/30">
                                                {new Date(record.date).toLocaleTimeString()}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white">{record.model}</div>
                                            <div className="text-sm text-white/50 font-mono">{record.serial}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {record.type === 'repair' ? (
                                                <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    record.repaired ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                                )}>
                                                    {record.repaired ? "Reparado" : "Pendiente"}
                                                </span>
                                            ) : record.type === 'issue' ? (
                                                <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    record.status === 'resolved' ? "bg-green-500/10 text-green-400" :
                                                        record.status === 'in_repair' ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"
                                                )}>
                                                    {record.status === 'resolved' ? "Resuelto" :
                                                        record.status === 'in_repair' ? "En Taller" : "Abierto"}
                                                </span>
                                            ) : (
                                                <div className="font-mono text-blue-300">
                                                    {record.finalWeight.toFixed(2)} / {record.targetWeight.toFixed(2)} kg
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-white/70 text-sm max-w-xs">
                                            {record.type === 'repair' ? (
                                                <div className="truncate text-white/50" title={record.diagnosis}>
                                                    <span className="text-orange-300/50">Diag:</span> {record.diagnosis}
                                                </div>
                                            ) : record.type === 'issue' ? (
                                                <div className="truncate text-white/50" title={record.description}>
                                                    <span className="text-red-300/50">Fallo:</span> {record.description}
                                                </div>
                                            ) : (
                                                <div className="truncate text-white/50">
                                                    {record.note || <span className="text-white/20 italic">Sin nota</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDelete(record.id)}
                                                className="p-2 hover:bg-red-500/20 text-white/20 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Eliminar Registro"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 border-t border-white/10 text-center text-xs text-white/20">
                    Sincronizado con Firebase Cloud
                </div>
            </div>
        </div>
    );
};
