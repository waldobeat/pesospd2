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

                <div className="overflow-x-hidden md:overflow-x-auto overflow-y-auto bg-black/40 flex-1 relative p-2 sm:p-0 custom-scrollbar">
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white">
                            <div className="flex items-center gap-3 bg-[#18181b] px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                <span className="font-medium text-blue-100">Cargando inventario...</span>
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse block md:table md:min-w-[800px]">
                        <thead className="bg-[#18181b] sticky top-0 z-10 shadow-md hidden md:table-header-group">
                            <tr>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest w-[150px]">Fecha Registro</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Equipo</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Sucursal</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest">Observaciones</th>
                                <th className="p-4 text-xs font-bold text-blue-400/60 uppercase tracking-widest text-right w-[120px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-0 md:divide-y divide-white/5 block md:table-row-group space-y-4 md:space-y-0">
                            {filteredRecords.length === 0 ? (
                                <tr className="block md:table-row">
                                    <td colSpan={5} className="p-16 text-center text-white/20 block md:table-cell">
                                        {loading ? "..." : "No hay equipos registrados en el inventario."}
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.id} className="hover:bg-blue-500/5 transition-colors group flex flex-col md:table-row bg-[#1e1e24] md:bg-transparent rounded-2xl md:rounded-none border border-white/10 md:border-none p-4 md:p-0 relative shadow-lg md:shadow-none">
                                        <td className="p-0 md:p-4 md:pl-6 text-white/60 font-mono text-sm whitespace-nowrap flex justify-between items-center md:table-cell mb-2 md:mb-0 border-b border-white/5 md:border-none pb-3 md:pb-0 relative">
                                            <span className="md:hidden text-xs text-blue-400/60 uppercase font-bold tracking-widest flex items-center gap-2">
                                                <PackagePlus className="w-4 h-4 text-blue-400" />
                                                Registro
                                            </span>
                                            <div className="text-right md:text-left">
                                                {new Date(record.date).toLocaleDateString()}
                                                <span className="block text-xs text-white/30 md:inline md:ml-2">
                                                    {new Date(record.date).toLocaleTimeString()}
                                                </span>
                                            </div>

                                            {/* Action Buttons purely for mobile header row */}
                                            <div className="absolute top-0 right-0 md:hidden flex items-center gap-1 -mt-1 -mr-1">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id!)}
                                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-0 md:p-4 flex justify-between items-center md:table-cell mb-3 md:mb-0 mt-3 md:mt-0">
                                            <span className="md:hidden text-xs text-white/40 uppercase font-bold tracking-wider">Equipo</span>
                                            <div className="text-right md:text-left">
                                                <div className="font-bold text-white text-lg md:text-lg text-base">{record.model}</div>
                                                <div className="text-sm text-blue-300 font-mono tracking-wider">{record.serial}</div>
                                            </div>
                                        </td>
                                        <td className="p-0 md:p-4 flex justify-between items-center md:table-cell mb-3 md:mb-0">
                                            <span className="md:hidden text-xs text-white/40 uppercase font-bold tracking-wider">Sucursal</span>
                                            <div className="text-right md:text-left">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/5 text-white/80 border border-white/10">
                                                    {record.branch || "N/A"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4 text-white/60 text-sm max-w-none md:max-w-[200px] bg-black/20 md:bg-transparent rounded-lg md:rounded-none">
                                            <span className="md:hidden text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1 block">Observaciones</span>
                                            <div className="truncate md:line-clamp-none whitespace-normal" title={record.note}>
                                                {record.note || <span className="text-white/20 italic">Sin observaciones</span>}
                                            </div>
                                        </td>
                                        <td className="p-0 md:p-4 text-right md:pr-6 hidden md:table-cell">
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
