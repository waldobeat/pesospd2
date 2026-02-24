import React, { useState, useEffect } from 'react';
import {
    Bell, X, CheckCircle2, AlertTriangle, Truck,
    ChevronDown, ChevronUp, RefreshCw, Clock
} from 'lucide-react';
import { notificationService } from '../services/NotificationService';
import type { AppNotification } from '../services/NotificationService';
import { inventoryService, BRANCH_LABELS } from '../services/InventoryService';
import type { InventoryItem } from '../services/InventoryService';
import type { User } from 'firebase/auth';
import clsx from 'clsx';

interface GlobalNotificationsProps {
    user: User | null;
    isMaster: boolean;
}

const TYPE_CONFIG = {
    issue_report: {
        icon: AlertTriangle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        label: 'Avería Reportada',
    },
    status_change: {
        icon: RefreshCw,
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        label: 'Cambio de Estado',
    },
    transfer_request: {
        icon: Truck,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'En Tránsito',
    },
};

export function GlobalNotifications({ user, isMaster }: GlobalNotificationsProps) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [pendingTransfers, setPendingTransfers] = useState<InventoryItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);

    // Subscribe to general notifications
    useEffect(() => {
        if (!user) return;
        return notificationService.subscribeToActive(
            user.email ?? '',
            isMaster,
            setNotifications
        );
    }, [user, isMaster]);

    // Subscribe to pending transfers (for master users)
    useEffect(() => {
        if (!user || !isMaster) return;
        return inventoryService.subscribeToPendingTransfers('taller', (items) => {
            setPendingTransfers(items);
        });
    }, [user, isMaster]);

    const totalCount = notifications.length + pendingTransfers.length;

    if (totalCount === 0) return null;

    const handleResolve = async (id: string) => {
        setResolvingId(id);
        try {
            await notificationService.resolve(id, user?.email ?? '');
        } finally {
            setResolvingId(null);
        }
    };

    const handleConfirmTransfer = async (item: InventoryItem) => {
        setConfirmingTransferId(item.id);
        try {
            await inventoryService.confirmTransfer(item.id, user?.email ?? 'Taller');
        } finally {
            setConfirmingTransferId(null);
        }
    };

    const handleRejectTransfer = async (item: InventoryItem) => {
        setConfirmingTransferId(item.id);
        try {
            await inventoryService.rejectTransfer(item.id, user?.email ?? 'Taller', 'Rechazado por el receptor');
        } finally {
            setConfirmingTransferId(null);
        }
    };

    const formatTime = (ts: { seconds: number } | undefined) => {
        if (!ts) return '';
        return new Date(ts.seconds * 1000).toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="fixed top-20 right-4 z-[200] w-full max-w-sm">

            {/* Badge button */}
            <button
                onClick={() => setIsOpen((o) => !o)}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl border
                    bg-gray-900/95 border-gray-700 text-white hover:bg-gray-800
                    backdrop-blur-sm w-full transition-all"
            >
                <div className="relative">
                    <Bell className="w-5 h-5 text-amber-400" />
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 shadow">
                        {totalCount}
                    </span>
                </div>
                <span className="font-semibold text-sm flex-1 text-left">
                    {totalCount === 1
                        ? '1 notificación pendiente'
                        : `${totalCount} notificaciones pendientes`}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-700/80 bg-gray-800/60 flex items-center justify-between">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-400" />
                            Centro de Notificaciones
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-700/50">

                        {/* ── Pending Transfers ── */}
                        {pendingTransfers.map((item) => (
                            <div key={item.id} className="p-4 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <Truck className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold text-sm">
                                            Equipo en Tránsito
                                        </p>
                                        <p className="text-amber-300 text-xs mt-0.5">
                                            {item.scaleModel} <span className="font-mono text-white/60">#{item.serialNumber}</span>
                                        </p>
                                        <p className="text-white/50 text-xs mt-1">
                                            {BRANCH_LABELS[item.pendingTransfer?.from ?? ''] ?? item.pendingTransfer?.from}
                                            {' → '}
                                            {BRANCH_LABELS[item.pendingTransfer?.to ?? ''] ?? item.pendingTransfer?.to}
                                        </p>
                                        {item.pendingTransfer?.notes && (
                                            <p className="text-white/40 text-xs italic mt-1">"{item.pendingTransfer.notes}"</p>
                                        )}
                                        <p className="text-white/30 text-xs flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(item.pendingTransfer?.initiatedAt)}
                                            {' · '}
                                            {item.pendingTransfer?.initiatedBy?.split('@')[0]}
                                        </p>
                                    </div>
                                </div>
                                {isMaster && (
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleConfirmTransfer(item)}
                                            disabled={confirmingTransferId === item.id}
                                            className="flex-1 text-xs font-bold py-1.5 px-3 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {confirmingTransferId === item.id ? '...' : 'Confirmar Recepción'}
                                        </button>
                                        <button
                                            onClick={() => handleRejectTransfer(item)}
                                            disabled={confirmingTransferId === item.id}
                                            className="text-xs font-bold py-1.5 px-3 rounded-lg bg-red-700/80 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                                        >
                                            Rechazar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* ── Issue / Status Notifications ── */}
                        {notifications.map((n) => {
                            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.status_change;
                            const Icon = cfg.icon;
                            return (
                                <div key={n.id} className={clsx('p-4 hover:bg-white/5 transition-colors', !n.read && 'bg-white/[0.03]')}>
                                    <div className="flex items-start gap-3">
                                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                                            <Icon className={clsx('w-4 h-4', cfg.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white font-semibold text-sm">{n.title}</p>
                                                {!n.read && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-white/60 text-xs mt-0.5">{n.message}</p>
                                            {n.relatedSerial && (
                                                <p className="text-white/40 text-xs mt-0.5 font-mono">
                                                    {n.relatedModel} #{n.relatedSerial}
                                                </p>
                                            )}
                                            <p className="text-white/30 text-xs flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(n.createdAt)}
                                                {' · '}
                                                {n.fromUser.split('@')[0]}
                                            </p>
                                        </div>
                                    </div>
                                    {isMaster && (
                                        <button
                                            onClick={() => handleResolve(n.id)}
                                            disabled={resolvingId === n.id}
                                            className="mt-2 w-full text-xs font-bold py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {resolvingId === n.id ? 'Marcando...' : 'Marcar como Atendido'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Hook: returns total pending notification count for badges */
export function useNotificationCount(user: User | null, isMaster: boolean): number {
    const [count, setCount] = useState(0);

    // General notifications
    useEffect(() => {
        if (!user) return;
        return notificationService.subscribeToActive(user.email ?? '', isMaster, (notifs) => {
            setCount((prev) => {
                // store notifs count in closure, we'll combine with transfers below
                return notifs.length;
            });
        });
    }, [user, isMaster]);

    return count;
}
