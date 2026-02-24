import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, AlertCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import type { User } from 'firebase/auth';
import { historyService } from '../services/HistoryService';
import type { InventoryStatus } from '../services/InventoryService';
import { ALL_BRANCHES, BRANCH_LABELS } from '../services/InventoryService';
import clsx from 'clsx';

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

const STATUS_COLORS: Record<string, string> = {
    'OPERATIVO': 'text-green-400  bg-green-500/10  border-green-500/30',
    'DAÑADO': 'text-red-400    bg-red-500/10    border-red-500/30',
    'EN TALLER': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    'EN ESPERA': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    'ENVIADO': 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    'TRANSFERIDO': 'text-blue-400   bg-blue-500/10   border-blue-500/30',
    'DADO DE BAJA': 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30',
};

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
    const canTransfer = isCentral || isWorkshop;

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

    const statusChanged = status !== inventoryItem.currentStatus;
    const requiresDestination = status === 'ENVIADO' || status === 'TRANSFERIDO';
    const requiresNote = !statusChanged; // must have note if status unchanged

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!statusChanged && !note.trim()) {
            setError('Debe cambiar el estado o agregar una nota para registrar la operación.');
            return;
        }
        if (requiresDestination && !destination) {
            setError('Debe especificar la sucursal de destino para esta operación.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const defaultNote = statusChanged
            ? `Cambio de estado: ${inventoryItem.currentStatus} → ${status}`
            : note.trim();

        try {
            await historyService.save({
                model: inventoryItem.model,
                serial: inventoryItem.serialNumber,
                branch: inventoryItem.branch,
                note: note.trim() || defaultNote,
                user: user?.email || 'Anon',
                status: status,
                inventoryId: inventoryItem.id,
                destination: requiresDestination ? destination : undefined,
                updatedBy: user?.email || 'Anon',
            } as any, 'inventory_op');

            setSuccess(true);
            setTimeout(() => onClose(), 2000);
        } catch (err: any) {
            setError(err.message || 'Error al actualizar estado operativo');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputCls = 'w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white leading-tight">Actualizar Equipo</h2>
                            <p className="text-xs text-white/30">Registro de operación de inventario</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

                    {/* Alerts */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Estado actualizado y registrado en historial.
                        </div>
                    )}

                    {/* Item Info */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <span className="text-white/40 block text-[10px] uppercase tracking-wider mb-1">Equipo Seleccionado</span>
                            <strong className="text-white text-base block truncate">{inventoryItem.model}</strong>
                            <span className="text-white/50 font-mono text-xs">{inventoryItem.serialNumber}</span>
                            <span className="block text-white/30 text-xs mt-0.5 capitalize">
                                {BRANCH_LABELS[inventoryItem.branch] || inventoryItem.branch}
                            </span>
                        </div>
                        <span className={clsx(
                            'flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border',
                            STATUS_COLORS[inventoryItem.currentStatus] || 'text-white/50 bg-white/5 border-white/10'
                        )}>
                            {inventoryItem.currentStatus}
                        </span>
                    </div>

                    {/* Status Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Nuevo Estatus Lógico</label>

                        {/* Status Change Indicator */}
                        {statusChanged && (
                            <div className="flex items-center gap-2 text-xs mb-1">
                                <span className={clsx('px-2 py-0.5 rounded-full border text-[10px] font-bold', STATUS_COLORS[inventoryItem.currentStatus])}>
                                    {inventoryItem.currentStatus}
                                </span>
                                <ArrowRight className="w-3 h-3 text-white/30" />
                                <span className={clsx('px-2 py-0.5 rounded-full border text-[10px] font-bold', STATUS_COLORS[status])}>
                                    {status}
                                </span>
                            </div>
                        )}

                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                            className={inputCls}
                            disabled={isSubmitting || success}
                        >
                            <option value="OPERATIVO">OPERATIVO</option>
                            <option value="DAÑADO">DAÑADO</option>
                            <option value="EN TALLER">EN TALLER</option>
                            <option value="EN ESPERA">EN ESPERA</option>
                            {canTransfer && (
                                <>
                                    <option value="ENVIADO">ENVIADO A SUCURSAL</option>
                                    <option value="TRANSFERIDO">TRANSFERIDO A SUCURSAL</option>
                                </>
                            )}
                            <option value="DADO DE BAJA">DADO DE BAJA</option>
                        </select>
                        <p className="text-[10px] text-white/25 pl-1">Este cambio quedará registrado en el historial de operaciones.</p>
                    </div>

                    {/* Destination Branch (only for ENVIADO / TRANSFERIDO) */}
                    {requiresDestination && (
                        <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">
                                Sucursal de Destino *
                            </label>
                            <select
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className={`${inputCls} border-blue-500/40`}
                                disabled={isSubmitting || success}
                            >
                                <option value="">-- Seleccionar Destino --</option>
                                {ALL_BRANCHES
                                    .filter((b) => b !== inventoryItem.branch)
                                    .map((b) => (
                                        <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    {/* Note */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">
                            Nota / Observación
                            {requiresNote && <span className="text-red-400 ml-1">*</span>}
                            {!requiresNote && <span className="text-white/20 normal-case font-normal ml-1">(Opcional)</span>}
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={`${inputCls} resize-none`}
                            placeholder={statusChanged
                                ? 'Ej. Se envió por reemplazo temporal...'
                                : 'Debe ingresar una observación si no cambia el estado...'
                            }
                            rows={3}
                            disabled={isSubmitting || success}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting || success}
                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors border border-white/10"
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || success}
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
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
