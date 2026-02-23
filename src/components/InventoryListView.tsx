import React, { useState, useEffect } from 'react';
import { inventoryService, type InventoryItem, type InventoryStatus } from '../services/InventoryService';
import { Box, Search, X, Activity, RefreshCw } from 'lucide-react';
import { InventoryStatusModal } from './InventoryStatusModal';
import clsx from 'clsx';
import type { User } from 'firebase/auth';

interface InventoryListViewProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export function InventoryListView({ isOpen, onClose, user }: InventoryListViewProps) {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<{
        id: string;
        serialNumber: string;
        model: string;
        currentStatus: InventoryStatus;
        branch: string;
    } | null>(null);

    const userPrefix = user?.email?.split('@')[0] || '';
    const isCentral = userPrefix.toLowerCase() === 'central';

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        const unsubscribe = inventoryService.subscribeToInventory((newItems) => {
            setItems(newItems);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen]);

    if (!isOpen) return null;

    // Filter items based on role and search term
    const filteredItems = items.filter(item => {
        // Enforce branch visibility rules
        if (!isCentral && item.branch !== userPrefix && item.branch !== `usuario central sucursal ${userPrefix}`) {
            return false;
        }

        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();
        return (
            item.serialNumber.toLowerCase().includes(term) ||
            item.scaleModel.toLowerCase().includes(term) ||
            item.branch.toLowerCase().includes(term) ||
            item.status.toLowerCase().includes(term)
        );
    });

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'OPERATIVO': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'DAÑADO': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'EN TALLER': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'DADO DE BAJA': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#18181b] w-full max-w-6xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Box className="w-6 h-6 text-blue-400" />
                                Base de Inventario Físico
                            </h2>
                            <p className="text-white/40 text-sm mt-1">
                                {isCentral ? 'Mostrando equipos de todas las sucursales' : `Mostrando equipos de la sucursal: ${userPrefix.toUpperCase()}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
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
                                placeholder="Buscar por Serial, Modelo, Sucursal o Estatus..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div className="flex items-center text-white/40 text-sm font-mono px-2">
                            {filteredItems.length} Equipos
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto overflow-y-auto bg-black/40 flex-1 relative">
                        {loading && (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center text-white">
                                Cargando inventario...
                            </div>
                        )}
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider w-[120px]">Estatus</th>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Modelo / Tipo</th>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Serial</th>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Sucursal</th>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider">Últ. Modificación</th>
                                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-wider text-center w-[120px]">Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-white/20">
                                            {loading ? "..." : "No se encontraron equipos registrados."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 px-6">
                                                <span className={clsx("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide border", getStatusStyle(item.status))}>
                                                    {item.status === 'OPERATIVO' ? <Activity className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-white text-sm">{item.scaleModel}</div>
                                                <div className="text-xs text-white/50">{item.weightType}</div>
                                            </td>
                                            <td className="p-4 font-mono text-sm text-white/80">
                                                {item.serialNumber}
                                            </td>
                                            <td className="p-4 capitalize text-sm text-white/70">
                                                {item.branch}
                                            </td>
                                            <td className="p-4 text-white/50 text-xs">
                                                {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString() : 'N/A'}
                                                <span className="block opacity-50">
                                                    {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString() : ''}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setSelectedItem({
                                                        id: item.id,
                                                        serialNumber: item.serialNumber,
                                                        model: item.scaleModel,
                                                        currentStatus: item.status as any,
                                                        branch: item.branch
                                                    })}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white rounded-lg transition-all text-xs font-bold"
                                                >
                                                    ACTUALIZAR
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <InventoryStatusModal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                user={user}
                inventoryItem={selectedItem}
            />
        </>
    );
}
