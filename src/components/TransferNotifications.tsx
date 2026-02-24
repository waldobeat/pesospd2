import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, XCircle, Bell, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { inventoryService, BRANCH_LABELS } from '../services/InventoryService';
import type { InventoryItem } from '../services/InventoryService';
import type { User } from 'firebase/auth';
import { historyService } from '../services/HistoryService';
import clsx from 'clsx';

interface TransferNotificationsProps {
    user: User | null;
    isMaster: boolean; // taller or central
    /** Called by parent so it can show the badge count on the nav button */
    onCountChange?: (count: number) => void;
}

export function TransferNotifications({ user, isMaster, onCountChange }: TransferNotificationsProps) {
    const [pendingItems, setPendingItems] = useState<InventoryItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const userPrefix = user?.email?.split('@')[0]?.toLowerCase() ?? '';

    useEffect(() => {
        if (!user) return;
        const targetBranch = isMaster ? 'taller' : userPrefix;
        const unsub = inventoryService.subscribeToPendingTransfers(targetBranch, (items) => {
            setPendingItems(items);
            onCountChange?.(items.length);
        });
        return () => unsub();
    }, [user, isMaster, userPrefix, onCountChange]);

    if (pendingItems.length === 0) return null;

    const handleConfirm = async (item: InventoryItem) => {
        if (!user) return;
        setConfirming(item.id);
        setError(null);
        try {
            await inventoryService.confirmTransfer(item.id, user.email ?? 'Taller');

            // Log to history
            await historyService.save({
                model: item.scaleModel,
                serial: item.serialNumber,
                branch: item.pendingTransfer?.to ?? item.branch,
                note: `Recepción confirmada desde ${BRANCH_LABELS[item.pendingTransfer?.from ?? ''] ?? item.pendingTransfer?.from}`,
                user: user.email ?? '',
                status: 'EN TALLER',
                inventoryId: item.id,
                destination: item.pendingTransfer?.to,
                updatedBy: user.email ?? '',
            }, 'inventory_op');
        } catch {
            setError('Error al confirmar la recepción. Intenta de nuevo.');
        } finally {
            setConfirming(null);
        }
    };

    const handleReject = async (item: InventoryItem) => {
        if (!user) return;
        setRejecting(item.id);
        setError(null);
        try {
            await inventoryService.rejectTransfer(
                item.id,
                user.email ?? 'Taller',
                'Rechazado por el receptor'
            );
        } catch {
            setError('Error al rechazar la transferencia. Intenta de nuevo.');
        } finally {
            setRejecting(null);
        }
    };

    const formatTime = (ts: { seconds: number } | undefined) => {
        if (!ts) return '';
        return new Date(ts.seconds * 1000).toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
            {/* Notification Badge Button */}
            <button
                onClick={() => setIsOpen((o) => !o)}
                className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border transition-all w-full',
                    'bg-amber-500/90 border-amber-400 text-white hover:bg-amber-500',
                    'backdrop-blur-sm'
                )}
            >
                <div className="relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {pendingItems.length}
                    </span>
                </div>
                <span className="font-semibold text-sm flex-1 text-left">
                    {pendingItems.length === 1
                        ? '1 transferencia pendiente de confirmar'
                        : `${pendingItems.length} transferencias pendientes`}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Expanded Panel */}
            {isOpen && (
                <div className="mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/80">
                        <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                            <Truck className="w-4 h-4 text-amber-400" />
                            Equipos en tránsito hacia tu sucursal
                        </h3>
                    </div>

                    {error && (
                        <div className="m-3 p-3 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <p className="text-red-300 text-xs">{error}</p>
                        </div>
                    )}

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-700/50">
                        {pendingItems.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                                {/* Item info */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-white font-medium text-sm">
                                            {item.scaleModel}
                                            <span className="text-gray-400 font-mono ml-1">#{item.serialNumber}</span>
                                        </p>
                                        <p className="text-amber-400 text-xs flex items-center gap-1 mt-0.5">
                                            <Truck className="w-3 h-3" />
                                            {BRANCH_LABELS[item.pendingTransfer?.from ?? ''] ?? item.pendingTransfer?.from}
                                            {' → '}
                                            {BRANCH_LABELS[item.pendingTransfer?.to ?? ''] ?? item.pendingTransfer?.to}
                                        </p>
                                        {item.pendingTransfer?.notes && (
                                            <p className="text-gray-400 text-xs mt-1 italic">
                                                "{item.pendingTransfer.notes}"
                                            </p>
                                        )}
                                        <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(item.pendingTransfer?.initiatedAt)}
                                            {' · '}
                                            {item.pendingTransfer?.initiatedBy?.split('@')[0]}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0">
                                        {item.weightType}
                                    </span>
                                </div>

                                {/* Action buttons — only for master users (taller/central) */}
                                {isMaster && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleConfirm(item)}
                                            disabled={confirming === item.id || rejecting === item.id}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {confirming === item.id ? 'Confirmando...' : 'Confirmar Recepción'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(item)}
                                            disabled={confirming === item.id || rejecting === item.id}
                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700/80 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            {rejecting === item.id ? '...' : 'Rechazar'}
                                        </button>
                                    </div>
                                )}

                                {/* Non-master: just info */}
                                {!isMaster && item.pendingTransfer?.to === userPrefix && (
                                    <p className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
                                        ⏳ Pendiente de confirmación por el receptor
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Hook for components that only need the count (e.g., nav badge) */
export function usePendingTransferCount(user: User | null, isMaster: boolean): number {
    const [count, setCount] = useState(0);
    const userPrefix = user?.email?.split('@')[0]?.toLowerCase() ?? '';

    useEffect(() => {
        if (!user) return;
        const targetBranch = isMaster ? 'taller' : userPrefix;
        const unsub = inventoryService.subscribeToPendingTransfers(targetBranch, (items) => {
            setCount(items.length);
        });
        return () => unsub();
    }, [user, isMaster, userPrefix]);

    return count;
}
