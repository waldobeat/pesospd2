import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { useAuthRole } from '../hooks/useAuthRole';
import { historyService, type InventoryRecord } from '../services/HistoryService';
import { X, PackagePlus, Trash2, Edit3, Search, Box } from 'lucide-react';
import { InventoryModal } from './InventoryModal';

interface InventoryViewProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ isOpen, onClose }) => {
    const [records, setRecords] = useState<InventoryRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);

    const { isAdmin } = useAuthRole(auth.currentUser);

    useEffect(() => {
        if (isOpen) {
            loadRecords();
        }
    }, [isOpen, isAdmin]);

    const loadRecords = async () => {
        setLoading(true);
        const userEmail = auth.currentUser?.email || "";
        const data = await historyService.getAll(userEmail, isAdmin);
        const inventoryRecords = data.filter(r => r.type === 'inventory') as InventoryRecord[];
        setRecords(inventoryRecords);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Está seguro de eliminar este registro del inventario?")) {
            await historyService.delete(id);
            loadRecords();
        }
    };

    const handleEdit = async (record: InventoryRecord) => {
        const newModel = prompt("Modelo (Actual: " + record.model + "):", record.model);
        if (newModel === null) return;
        const newSerial = prompt("Serial (Actual: " + record.serial + "):", record.serial);
        if (newSerial === null) return;
        const newBranch = prompt("Sucursal (Actual: " + record.branch + "):", record.branch || "");
        if (newBranch === null) return;
        const newNote = prompt("Nota (Actual: " + record.note + "):", record.note);
        if (newNote === null) return;

        if (confirm("¿Guardar cambios en el inventario?")) {
            await historyService.update(record.id!, {
                model: newModel.toUpperCase(),
                serial: newSerial.toUpperCase(),
                branch: newBranch.toUpperCase(),
                note: newNote
            });
            loadRecords();
        }
    };

    const filteredRecords = records.filter(r =>
        r.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.note.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.branch && r.branch.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#18181b] w-full max-w-6xl rounded-3xl border border-blue-500/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-blue-500/5">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Box className="w-6 h-6 text-blue-400" />
                            Gestión de Inventario
                        </h2>
                        <p className="text-blue-200/60 text-sm mt-1">
                            {isAdmin ? "Inventario general de todas las sucursales" : "Inventario registrado por su sucursal"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsRegisterOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-bold flex items-center gap-2 shadow-lg"
                        >
                            <PackagePlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nuevo Registro</span>
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-1"></div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-white/10 bg-black/20 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/40" />
                        <input
                            type="text"
                            placeholder="Buscar por Equipo, Serial o Sucursal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex items-center text-blue-400/60 text-sm font-mono px-2 font-bold bg-blue-500/10 rounded-lg px-4 border border-blue-500/20">
                        Total: {filteredRecords.length}
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto bg-black/40 flex-1 relative custom-scrollbar">
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white">
                            <div className="flex items-center gap-3 bg-[#18181b] px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                <span className="font-medium text-blue-100">Cargando inventario...</span>
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-[#18181b] sticky top-0 z-10 shadow-md">
                            <tr>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest w-[150px]">Fecha Registro</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Equipo</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Sucursal</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Observaciones</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest text-right w-[120px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center text-white/20">
                                        {loading ? "..." : "No hay equipos registrados en el inventario."}
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.id} className="hover:bg-blue-500/5 transition-colors group">
                                        <td className="p-4 text-white/60 font-mono text-sm whitespace-nowrap pl-6">
                                            {new Date(record.date).toLocaleDateString()}
                                            <span className="block text-xs text-white/30">
                                                {new Date(record.date).toLocaleTimeString()}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white text-lg">{record.model}</div>
                                            <div className="text-sm text-blue-300 font-mono tracking-wider">{record.serial}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/5 text-white/80 border border-white/10">
                                                {record.branch || "N/A"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white/60 text-sm max-w-[200px]">
                                            <div className="truncate" title={record.note}>
                                                {record.note || <span className="text-white/20 italic">Sin observaciones</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="p-2 bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 hover:text-white rounded-lg transition-all"
                                                    title="Editar Equipo"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id!)}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-white rounded-lg transition-all"
                                                    title="Eliminar Registro"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Embedded Modal so records automatically update when closing the modal since it shares the parent loadRecords conceptually */}
            <InventoryModal
                isOpen={isRegisterOpen}
                onClose={() => {
                    setIsRegisterOpen(false);
                    loadRecords();
                }}
            />
        </div>
    );
};
