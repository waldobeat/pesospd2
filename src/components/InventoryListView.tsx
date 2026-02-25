import React, { useState, useEffect, useMemo } from 'react';
import {
    inventoryService,
    type InventoryItem,
    type InventoryStatus,
    type InventoryFilter,
    ALL_BRANCHES,
    BRANCH_LABELS,
} from '../services/InventoryService';
import {
    Box, Search, X, Activity, RefreshCw, Download, Filter,
    ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle,
    CheckCircle2, Clock, Truck, Ban, BarChart3, Trash2, Pencil,
} from 'lucide-react';
import { InventoryStatusModal } from './InventoryStatusModal';
import clsx from 'clsx';
import type { User } from 'firebase/auth';

interface InventoryListViewProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

type SortField = 'status' | 'scaleModel' | 'serialNumber' | 'branch' | 'updatedAt' | 'timestamp';
type SortDir = 'asc' | 'desc';

const STATUS_STYLES: Record<string, string> = {
    'OPERATIVO': 'bg-green-500/10 text-green-400 border-green-500/20',
    'DAÑADO': 'bg-red-500/10 text-red-400 border-red-500/20',
    'EN TALLER': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'EN ESPERA': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'ENVIADO': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'TRANSFERIDO': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'DADO DE BAJA': 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
    'REPARANDO': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'EN TRÁNSITO': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const ROW_SHADOW: Record<string, string> = {
    'DAÑADO': 'bg-red-500/5',
    'EN TALLER': 'bg-orange-500/5',
    'EN ESPERA': 'bg-yellow-500/5',
    'REPARANDO': 'bg-cyan-500/5',
    'EN TRÁNSITO': 'bg-amber-500/5',
    'DADO DE BAJA': 'bg-neutral-900/60',
};

const STATUS_MAP: Record<string, string> = {
    total: '',
    operativo: 'OPERATIVO',
    enTaller: 'EN TALLER',
    danado: 'DAÑADO',
    enEspera: 'EN ESPERA',
    enviado: 'ENVIADO',
    enTransito: 'EN TRÁNSITO',
    dadoDeBaja: 'DADO DE BAJA',
};

const KPI_CARDS = [
    { label: 'Total', key: 'total', icon: Box, color: 'text-white', bg: 'bg-white/5' },
    { label: 'Operativo', key: 'operativo', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'En Taller', key: 'enTaller', icon: RefreshCw, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Dañado', key: 'danado', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'En Espera', key: 'enEspera', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Enviado', key: 'enviado', icon: Truck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'En Tránsito', key: 'enTransito', icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'De Baja', key: 'dadoDeBaja', icon: Ban, color: 'text-neutral-400', bg: 'bg-neutral-500/10' },
];

const PAGE_SIZE = 20;

export function InventoryListView({ isOpen, onClose, user }: InventoryListViewProps) {
    const [allItems, setAllItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<InventoryFilter>({
        searchTerm: '',
        branch: '',
        status: '',
        weightType: '',
    });
    const [sortField, setSortField] = useState<SortField>('timestamp');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    const [selectedItem, setSelectedItem] = useState<{
        id: string;
        serialNumber: string;
        model: string;
        currentStatus: InventoryStatus;
        branch: string;
        lastBranch?: string;
    } | null>(null);

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDeleteItem = async (item: InventoryItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`¿Eliminar permanentemente "${item.scaleModel}" (${item.serialNumber})? Esta acción no se puede deshacer.`)) return;
        setDeletingId(item.id);
        try {
            await inventoryService.deleteItem(item.id);
        } catch (err) {
            console.error('Error deleting item', err);
            alert('Error al eliminar el equipo.');
        } finally {
            setDeletingId(null);
        }
    };

    const userPrefix = user?.email?.split('@')[0] || '';
    const isCentral = userPrefix.toLowerCase() === 'central';
    const isWorkshop = userPrefix.toLowerCase() === 'taller';
    const isMaster = isCentral || isWorkshop;

    // ── Firestore subscription ──────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        const unsub = inventoryService.subscribeToInventory((items) => {
            setAllItems(items);
            setLoading(false);
        });
        return () => unsub();
    }, [isOpen]);

    // ── Branch-scoped items ─────────────────────────────────────────────────
    // IMPORTANT: All hooks must appear before any conditional return
    const scopedItems = useMemo(() => {
        if (isMaster) return allItems;
        return allItems.filter(
            (i) => i.branch === userPrefix ||
                i.recordedBy?.includes(userPrefix)
        );
    }, [allItems, isMaster, userPrefix]);

    // ── Stats (always from scoped items, ignoring filters) ─────────────────
    const stats = useMemo(() => inventoryService.computeStats(scopedItems), [scopedItems]);

    // ── Filtered & sorted ──────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        const base = inventoryService.applyFilters(scopedItems, filters);

        return [...base].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'status':
                    cmp = a.status.localeCompare(b.status); break;
                case 'scaleModel':
                    cmp = a.scaleModel.localeCompare(b.scaleModel); break;
                case 'serialNumber':
                    cmp = a.serialNumber.localeCompare(b.serialNumber); break;
                case 'branch':
                    cmp = a.branch.localeCompare(b.branch); break;
                case 'updatedAt':
                    cmp = (a.updatedAt?.seconds ?? 0) - (b.updatedAt?.seconds ?? 0); break;
                case 'timestamp':
                default:
                    cmp = (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0); break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [scopedItems, filters, sortField, sortDir]);

    // ── Pagination ─────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── Early return (after ALL hooks) ─────────────────────────────────────
    if (!isOpen) return null;

    // ── Helpers ────────────────────────────────────────────────────────────
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
        setPage(1);
    };

    const handleFilterChange = (key: keyof InventoryFilter, val: string) => {
        setFilters((prev) => ({ ...prev, [key]: val }));
        setPage(1);
    };

    const handleExportCSV = () => {
        const csv = inventoryService.exportToCSV(filteredItems);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
        return sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-400" />
            : <ChevronDown className="w-3 h-3 text-blue-400" />;
    };

    const activeFilterCount = [
        filters.branch, filters.status, filters.weightType
    ].filter(Boolean).length;

    const fmtDate = (ts?: { toDate: () => Date }) =>
        ts ? new Date(ts.toDate()).toLocaleDateString('es-VE') : '—';
    const fmtTime = (ts?: { toDate: () => Date }) =>
        ts ? new Date(ts.toDate()).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#18181b] w-full max-w-7xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

                    {/* ── Header ─────────────────────────────────────────────── */}
                    <div className="p-5 border-b border-white/10 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-white/5">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <BarChart3 className="w-6 h-6 text-blue-400" />
                                Base de Inventario Físico
                            </h2>
                            <p className="text-white/40 text-xs mt-1">
                                {isMaster
                                    ? '👁️ Modo Maestro — Visualización completa de todas las sucursales'
                                    : `📍 Sucursal: ${(BRANCH_LABELS[userPrefix] || userPrefix).toUpperCase()}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportCSV}
                                title="Exportar a CSV"
                                className="flex items-center gap-2 px-3 py-2 bg-green-600/10 hover:bg-green-600/20 border border-green-500/30 text-green-400 rounded-xl text-xs font-bold transition-all"
                            >
                                <Download className="w-4 h-4" />
                                CSV
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* ── KPI Cards ──────────────────────────────────────────── */}
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2 p-4 border-b border-white/10 bg-black/20">
                        {KPI_CARDS.map(({ label, key, icon: Icon, color, bg }) => {
                            const val = stats[key as keyof typeof stats];
                            const numVal = typeof val === 'number' ? val : 0;
                            const targetStatus = STATUS_MAP[key] ?? '';

                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        handleFilterChange('status', filters.status === targetStatus && targetStatus !== '' ? '' : targetStatus);
                                    }}
                                    className={clsx(
                                        'flex flex-col items-center justify-center gap-1 p-2 md:p-3 rounded-xl border transition-all',
                                        bg,
                                        (filters.status === targetStatus)
                                            ? 'border-white/30 scale-105'
                                            : 'border-white/5 hover:border-white/20'
                                    )}
                                >
                                    <Icon className={clsx('w-4 h-4', color)} />
                                    <span className={clsx('text-lg font-black leading-none', color)}>{numVal}</span>
                                    <span className="text-[9px] text-white/40 font-medium uppercase tracking-wide leading-none">{label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Toolbar ────────────────────────────────────────────── */}
                    <div className="p-3 border-b border-white/10 bg-black/20 flex flex-col gap-2">
                        <div className="flex gap-2">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="Buscar serial, modelo, sucursal, estatus..."
                                    value={filters.searchTerm || ''}
                                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm outline-none focus:border-blue-500/50 placeholder-white/30"
                                />
                                {filters.searchTerm && (
                                    <button
                                        onClick={() => handleFilterChange('searchTerm', '')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filter Toggle */}
                            <button
                                onClick={() => setShowFilters((v) => !v)}
                                className={clsx(
                                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                                    showFilters || activeFilterCount > 0
                                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                FILTROS
                                {activeFilterCount > 0 && (
                                    <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            {/* Results count */}
                            <div className="hidden md:flex items-center text-white/40 text-xs font-mono px-2">
                                {filteredItems.length} / {scopedItems.length}
                            </div>
                        </div>

                        {/* Expanded Filters */}
                        {showFilters && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                                {/* Branch filter */}
                                {isMaster && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-wide pl-1">Sucursal</label>
                                        <select
                                            value={filters.branch || ''}
                                            onChange={(e) => handleFilterChange('branch', e.target.value)}
                                            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50"
                                        >
                                            <option value="">Todas las sucursales</option>
                                            {ALL_BRANCHES.map((b) => (
                                                <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Status filter */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-wide pl-1">Estatus</label>
                                    <select
                                        value={filters.status || ''}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50"
                                    >
                                        <option value="">Todos los estatus</option>
                                        <option value="OPERATIVO">OPERATIVO</option>
                                        <option value="DAÑADO">DAÑADO</option>
                                        <option value="EN TALLER">EN TALLER</option>
                                        <option value="EN ESPERA">EN ESPERA</option>
                                        <option value="ENVIADO">ENVIADO</option>
                                        <option value="TRANSFERIDO">TRANSFERIDO</option>
                                        <option value="DADO DE BAJA">DADO DE BAJA</option>
                                    </select>
                                </div>

                                {/* Type filter */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-wide pl-1">Tipo</label>
                                    <select
                                        value={filters.weightType || ''}
                                        onChange={(e) => handleFilterChange('weightType', e.target.value)}
                                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50"
                                    >
                                        <option value="">Todos los tipos</option>
                                        <option value="PESO">PESO</option>
                                        <option value="BALANZA">BALANZA</option>
                                    </select>
                                </div>

                                {/* Clear */}
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={() => setFilters({ searchTerm: filters.searchTerm, branch: '', status: '', weightType: '' })}
                                        className="md:col-span-3 text-xs text-red-400/70 hover:text-red-400 text-left pl-1 transition-colors"
                                    >
                                        ✕ Limpiar filtros activos ({activeFilterCount})
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Table ──────────────────────────────────────────────── */}
                    <div className="overflow-x-auto overflow-y-auto flex-1 relative">
                        {loading && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 text-white">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                                <span className="text-sm text-white/50">Cargando inventario en tiempo real...</span>
                            </div>
                        )}

                        {/* Desktop Table */}
                        <table className="w-full text-left border-collapse min-w-[900px] hidden md:table">
                            <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
                                <tr>
                                    {[
                                        { label: 'Estatus', field: 'status' as SortField, w: 'w-[130px]' },
                                        { label: 'Modelo / Tipo', field: 'scaleModel' as SortField },
                                        { label: 'Serial', field: 'serialNumber' as SortField },
                                        { label: 'Sucursal', field: 'branch' as SortField },
                                        { label: 'Registrado', field: 'timestamp' as SortField },
                                        { label: 'Últ. Mod.', field: 'updatedAt' as SortField },
                                        { label: 'Control', field: null, },
                                    ].map(({ label, field, w }) => (
                                        <th
                                            key={label}
                                            onClick={field ? () => handleSort(field) : undefined}
                                            className={clsx(
                                                'p-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-wider',
                                                w,
                                                field && 'cursor-pointer hover:text-white/70 select-none'
                                            )}
                                        >
                                            <div className="flex items-center gap-1">
                                                {label}
                                                {field && <SortIcon field={field} />}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-16 text-center text-white/20">
                                            {loading ? '...' : '— No se encontraron equipos con los filtros aplicados —'}
                                        </td>
                                    </tr>
                                ) : (
                                    pagedItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={clsx(
                                                'hover:bg-white/5 transition-colors group',
                                                ROW_SHADOW[item.status] || ''
                                            )}
                                        >
                                            {/* Status */}
                                            <td className="p-3 px-4">
                                                <span className={clsx(
                                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border',
                                                    STATUS_STYLES[item.status]
                                                )}>
                                                    {item.status === 'OPERATIVO' ? <Activity className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                                    {item.status}
                                                </span>
                                                {/* Transit badge */}
                                                {item.hasPendingTransfer && item.pendingTransfer && (
                                                    <div className="mt-1 text-[9px] text-amber-400 flex items-center gap-1 animate-pulse">
                                                        <Truck className="w-2.5 h-2.5" />
                                                        {BRANCH_LABELS[item.pendingTransfer.from] ?? item.pendingTransfer.from}
                                                        {' → '}
                                                        {BRANCH_LABELS[item.pendingTransfer.to] ?? item.pendingTransfer.to}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Model */}
                                            <td className="p-3 px-4">
                                                <div className="font-bold text-white text-sm">{item.scaleModel}</div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wide">{item.weightType}</div>
                                            </td>

                                            {/* Serial */}
                                            <td className="p-3 px-4 font-mono text-sm text-white/80">{item.serialNumber}</td>

                                            {/* Branch */}
                                            <td className="p-3 px-4 text-sm text-white/70 capitalize">
                                                {BRANCH_LABELS[item.branch] || item.branch}
                                            </td>

                                            {/* Registered */}
                                            <td className="p-3 px-4 text-white/40 text-xs">
                                                <div>{fmtDate(item.timestamp)}</div>
                                                <div className="opacity-50">{fmtTime(item.timestamp)}</div>
                                                {item.recordedBy && (
                                                    <div className="text-[10px] text-white/25 mt-0.5 truncate max-w-[100px]">{item.recordedBy}</div>
                                                )}
                                            </td>

                                            {/* Last Updated */}
                                            <td className="p-3 px-4 text-white/40 text-xs">
                                                <div>{fmtDate(item.updatedAt || item.timestamp)}</div>
                                                <div className="opacity-50">{fmtTime(item.updatedAt || item.timestamp)}</div>
                                                {item.updatedBy && (
                                                    <div className="text-[10px] text-white/25 mt-0.5 truncate max-w-[100px]">{item.updatedBy}</div>
                                                )}
                                            </td>

                                            {/* Control */}
                                            <td className="p-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {(() => {
                                                        const isWorkshopManaged = ['EN TALLER', 'REPARANDO', 'EN ESPERA', 'ENVIADO', 'TRANSFERIDO', 'EN TRÁNSITO'].includes(item.status);
                                                        const canEdit = isMaster || !isWorkshopManaged;

                                                        return (
                                                            <button
                                                                onClick={() => setSelectedItem({
                                                                    id: item.id,
                                                                    serialNumber: item.serialNumber,
                                                                    model: item.scaleModel,
                                                                    currentStatus: item.status,
                                                                    branch: item.branch,
                                                                    lastBranch: item.lastBranch,
                                                                    recordedBy: item.recordedBy,
                                                                })}
                                                                disabled={!canEdit}
                                                                className={clsx(
                                                                    "inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg transition-all text-[10px] font-bold opacity-70 group-hover:opacity-100 border",
                                                                    canEdit
                                                                        ? "bg-blue-600/15 hover:bg-blue-600 border-blue-500/25 hover:border-blue-500 text-blue-400 hover:text-white"
                                                                        : "bg-white/5 border-white/10 text-white/20 cursor-not-allowed"
                                                                )}
                                                                title={canEdit ? "Actualizar estado" : "Solo el Taller puede editar equipos en este estado"}
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                                {canEdit ? 'EDITAR' : 'BLOQUEADO'}
                                                            </button>
                                                        );
                                                    })()}
                                                    {isMaster && (
                                                        <button
                                                            onClick={(e) => handleDeleteItem(item, e)}
                                                            disabled={deletingId === item.id}
                                                            className="inline-flex items-center justify-center p-1.5 bg-red-500/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                            title="Eliminar equipo"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Mobile Cards */}
                        <div className="flex flex-col divide-y divide-white/5 md:hidden">
                            {filteredItems.length === 0 ? (
                                <div className="p-12 text-center text-white/20 text-sm">
                                    {loading ? 'Cargando...' : '— No se encontraron equipos —'}
                                </div>
                            ) : (
                                pagedItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className={clsx(
                                            'p-4 flex flex-col gap-2',
                                            ROW_SHADOW[item.status] || ''
                                        )}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-white">{item.scaleModel}</div>
                                                <div className="font-mono text-xs text-white/50">{item.serialNumber}</div>
                                            </div>
                                            <span className={clsx(
                                                'text-[10px] font-bold px-2 py-1 rounded-full border',
                                                STATUS_STYLES[item.status]
                                            )}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-white/40 flex gap-4">
                                            <span>📍 {BRANCH_LABELS[item.branch] || item.branch}</span>
                                            <span>📅 {fmtDate(item.updatedAt || item.timestamp)}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            {(() => {
                                                const isWorkshopManaged = ['EN TALLER', 'REPARANDO', 'EN ESPERA', 'ENVIADO', 'TRANSFERIDO', 'EN TRÁNSITO'].includes(item.status);
                                                const canEdit = isMaster || !isWorkshopManaged;

                                                return (
                                                    <button
                                                        onClick={() => setSelectedItem({
                                                            id: item.id,
                                                            serialNumber: item.serialNumber,
                                                            model: item.scaleModel,
                                                            currentStatus: item.status,
                                                            branch: item.branch,
                                                            lastBranch: item.lastBranch,
                                                            recordedBy: item.recordedBy,
                                                        })}
                                                        disabled={!canEdit}
                                                        className={clsx(
                                                            "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border",
                                                            canEdit
                                                                ? "bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white"
                                                                : "bg-white/5 border-white/10 text-white/20 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        {canEdit ? 'EDITAR ESTADO' : 'BLOQUEADO POR TALLER'}
                                                    </button>
                                                );
                                            })()}
                                            {isMaster && (
                                                <button
                                                    onClick={(e) => handleDeleteItem(item, e)}
                                                    disabled={deletingId === item.id}
                                                    className="py-2 px-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all hover:bg-red-600 hover:text-white disabled:opacity-50"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Pagination ─────────────────────────────────────────── */}
                    {totalPages > 1 && (
                        <div className="p-3 border-t border-white/10 bg-black/20 flex items-center justify-between text-xs text-white/40">
                            <span>
                                Pág. {page} / {totalPages} — {filteredItems.length} equipos
                            </span>
                            <div className="flex gap-1">
                                <button disabled={page === 1} onClick={() => setPage(1)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">‹‹</button>
                                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">‹</button>
                                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">›</button>
                                <button disabled={page === totalPages} onClick={() => setPage(totalPages)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">››</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Update Modal */}
            <InventoryStatusModal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                user={user}
                inventoryItem={selectedItem}
            />
        </>
    );
}
