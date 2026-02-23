import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import { historyService } from '../services/HistoryService';
import type { InventoryStatus } from '../services/InventoryService';

interface InventoryStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    inventoryItem: {
        id: string;
        serialNumber: string;
        model: string;
        currentStatus: InventoryStatus;
        branch: string;
    } | null;
}

export function InventoryStatusModal({ isOpen, onClose, user, inventoryItem }: InventoryStatusModalProps) {
    const [status, setStatus] = useState<InventoryStatus>('OPERATIVO');
    const [destination, setDestination] = useState('');
    const [note, setNote] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const userPrefix = user?.email?.split('@')[0] || '';
    const isCentral = userPrefix.toLowerCase() === 'central';
    const isWorkshop = userPrefix.toLowerCase() === 'taller';

    useEffect(() => {
        if (isOpen && inventoryItem) {
            setStatus(inventoryItem.currentStatus);
            setDestination('');
            setNote('');
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, inventoryItem]);

    if (!isOpen || !inventoryItem) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (status === inventoryItem.currentStatus && !note) {
            setError("Debe cambiar el estado o agregar una nota para registrar la operación.");
            return;
        }

        if ((status === 'ENVIADO' || status === 'TRANSFERIDO') && !destination) {
            setError("Debe especificar la sucursal de destino.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await historyService.save({
                model: inventoryItem.model,
                serial: inventoryItem.serialNumber,
                branch: inventoryItem.branch,
                note: note || `Cambio de estado: ${inventoryItem.currentStatus} -> ${status}`,
                user: user?.email || "Anon",
                status: status,
                inventoryId: inventoryItem.id,
                destination: (status === 'ENVIADO' || status === 'TRANSFERIDO') ? destination : undefined
            } as any, 'inventory_op');

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Error al actualizar estado operativbo');
        } finally {
            setIsSubmitting(false);
        }
    };

    const requiresDestination = status === 'ENVIADO' || status === 'TRANSFERIDO';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-bold text-white">Actualizar Equipo</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-white/50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                            Estado actualizado correctamente.
                        </div>
                    )}

                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm flex justify-between items-center">
                        <div>
                            <span className="text-white/40 block text-xs uppercase tracking-wider mb-1">Equipo Seleccionado</span>
                            <strong className="text-white text-base">{inventoryItem.model}</strong>
                            <span className="text-white/50 ml-2 font-mono">({inventoryItem.serialNumber})</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Nuevo Estatus Lógico</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                            disabled={isSubmitting || success}
                        >
                            <option value="OPERATIVO">OPERATIVO</option>
                            <option value="DAÑADO">DAÑADO</option>
                            <option value="EN TALLER">EN TALLER</option>
                            <option value="EN ESPERA">EN ESPERA</option>
                            {(isCentral || isWorkshop) && (
                                <>
                                    <option value="ENVIADO">ENVIADO A SUCURSAL</option>
                                    <option value="TRANSFERIDO">TRANSFERIDO A SUCURSAL</option>
                                </>
                            )}
                            <option value="DADO DE BAJA">DADO DE BAJA</option>
                        </select>
                        <p className="text-[10px] text-white/30 pl-1 mt-1">Este cambio quedará registrado en el historial de operaciones.</p>
                    </div>

                    {requiresDestination && (
                        <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Sucursal de Destino</label>
                            <select
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className="w-full bg-[#1e293b] border border-blue-500/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors appearance-none"
                                disabled={isSubmitting || success}
                            >
                                <option value="">-- Seleccionar Destino --</option>
                                <option value="sandiego">San Diego</option>
                                <option value="bosque">Bosque</option>
                                <option value="trigal">Trigal</option>
                                <option value="naguanagua">Naguanagua</option>
                                <option value="guacara">Guacara</option>
                                <option value="valencia">Valencia</option>
                            </select>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Nota / Observación <span className="text-white/20 normal-case font-normal">(Opcional)</span></label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            placeholder="Ej. Se envió por reemplazo temporal..."
                            rows={3}
                            disabled={isSubmitting || success}
                        />
                    </div>

                    <div className="mt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting || success}
                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-colors border border-white/10"
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || success}
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    ACTUALIZAR
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
