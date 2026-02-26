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
    'OPERATIVO': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    'DAÑADO': 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
    'EN TALLER': 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]',
    'EN ESPERA': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
    'ENVIADO': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]',
    'TRANSFERIDO': 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
    'DADO DE BAJA': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'REPARANDO': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]',
    'REPARADO': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    'EN TRÁNSITO': 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
};

const STATUS_MAP: Record<string, string> = {
    total: '',
    operativo: 'OPERATIVO',
    enTaller: 'EN TALLER',
    danado: 'DAÑADO',
    enEspera: 'EN ESPERA',
    enviado: 'ENVIADO',
    enTransito: 'EN TRÁNSITO',
    reparado: 'REPARADO',
    dadoDeBaja: 'DADO DE BAJA',
};

const KPI_CARDS = [
    { label: 'Total', key: 'total', icon: Box, color: 'text-white', bg: 'bg-white/5' },
    { label: 'Operativo', key: 'operativo', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'En Taller', key: 'enTaller', icon: RefreshCw, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Reparado', key: 'reparado', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
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
            (i: InventoryItem) => i.branch === userPrefix ||
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
            setSortDir((d: SortDir) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
        setPage(1);
    };

    const handleFilterChange = (key: keyof InventoryFilter, val: string) => {
        setFilters((prev: InventoryFilter) => ({ ...prev, [key]: val }));
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

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-500">
                <div className="relative w-full max-w-7xl h-[90vh] group">
                    {/* Outer Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/10 to-transparent rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="relative h-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">

                        {/* Header */}
                        <div className="relative p-8 border-b border-white/5 flex flex-col md:flex-row md:justify-between md:items-center gap-6 shrink-0">
                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                                    <BarChart3 className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight leading-none uppercase">
                                        Hardware_Inventory
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                        {isMaster
                                            ? 'SYSTEM_MASTER_VIEW // ALL_ACCESS'
                                            : `LOCAL_NODE // ${(BRANCH_LABELS[userPrefix] || userPrefix).toUpperCase()}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExportCSV}
                                    className="h-11 px-5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-2xl font-black text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95"
                                >
                                    <Download className="w-4 h-4" />
                                    EXPORT_DATA
                                </button>
                                <button
                                    onClick={onClose}
                                    className="h-11 w-11 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-500 hover:text-white transition-all active:scale-95"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="px-8 py-6 border-b border-white/5 bg-slate-900/50 flex flex-wrap gap-4 shrink-0">
                            {KPI_CARDS.map(({ label, key, icon: Icon, color }) => {
                                const val = stats[key as keyof typeof stats];
                                const numVal = typeof val === 'number' ? val : 0;
                                const targetStatus = STATUS_MAP[key] ?? '';
                                const isActive = filters.status === targetStatus && targetStatus !== '';

                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            handleFilterChange('status', isActive ? '' : targetStatus);
                                        }}
                                        className={clsx(
                                            'relative flex-1 min-w-[120px] h-20 px-4 rounded-2xl border transition-all duration-300 group/kpi overflow-hidden',
                                            isActive
                                                ? 'bg-blue-500/10 border-blue-500/30'
                                                : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                        )}
                                    >
                                        <div className="relative z-10 flex flex-col justify-between h-full py-3">
                                            <div className="flex items-center justify-between">
                                                <Icon className={clsx('w-3.5 h-3.5 opacity-50', color)} />
                                                <div className={clsx('text-lg font-black leading-none tracking-tighter', color)}>
                                                    {numVal.toString().padStart(2, '0')}
                                                </div>
                                            </div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-left">
                                                {label}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Toolbar */}
                        <div className="px-8 py-5 border-b border-white/5 bg-slate-900/30 flex flex-col gap-4 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="SEARCH_REGISTRY // SERIAL_NUMBER // MODEL_ID..."
                                        value={filters.searchTerm || ''}
                                        onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                        className="w-full h-11 bg-slate-950/50 border border-white/5 rounded-xl pl-12 pr-10 text-[11px] font-bold text-white uppercase tracking-wider outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder-slate-600 transition-all"
                                    />
                                    {filters.searchTerm && (
                                        <button
                                            onClick={() => handleFilterChange('searchTerm', '')}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => setShowFilters((v: boolean) => !v)}
                                    className={clsx(
                                        'h-11 px-6 rounded-xl text-[10px] font-black tracking-[0.2em] border transition-all flex items-center gap-3',
                                        showFilters || activeFilterCount > 0
                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/10'
                                    )}
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    ADVANCED_FILTERS
                                    {activeFilterCount > 0 && (
                                        <span className="w-4 h-4 rounded-md bg-blue-500 text-white text-[8px] flex items-center justify-center font-black">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {showFilters && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-950/40 border border-white/5 rounded-[1.5rem] animate-in slide-in-from-top-4 duration-500">
                                    {isMaster && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">Target_Branch</label>
                                            <select
                                                value={filters.branch || ''}
                                                onChange={(e) => handleFilterChange('branch', e.target.value)}
                                                className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-4 text-[10px] font-bold text-slate-300 outline-none focus:border-blue-500/30"
                                            >
                                                <option value="">ALL_STATIONS</option>
                                                {ALL_BRANCHES.map((b) => (
                                                    <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">System_Status</label>
                                        <select
                                            value={filters.status || ''}
                                            onChange={(e) => handleFilterChange('status', e.target.value)}
                                            className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-4 text-[10px] font-bold text-slate-300 outline-none focus:border-blue-500/30"
                                        >
                                            <option value="">ALL_MODES</option>
                                            {Object.keys(STATUS_STYLES).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">Module_Type</label>
                                        <select
                                            value={filters.weightType || ''}
                                            onChange={(e) => handleFilterChange('weightType', e.target.value)}
                                            className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-4 text-[10px] font-bold text-slate-300 outline-none focus:border-blue-500/30"
                                        >
                                            <option value="">ALL_TYPES</option>
                                            <option value="PESO">WEIGHT_MODULE</option>
                                            <option value="BALANZA">SCALE_DEVICE</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={() => setFilters({ searchTerm: filters.searchTerm, branch: '', status: '', weightType: '' })}
                                            className="h-10 w-full bg-red-500/5 hover:bg-red-500/10 text-red-400/50 hover:text-red-400 border border-red-500/10 rounded-xl text-[9px] font-black tracking-widest transition-all"
                                        >
                                            RESET_FILTERS
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Table Section */}
                        <div className="flex-1 overflow-auto relative">
                            {loading && (
                                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-4">
                                    <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] animate-pulse">Syncing_Database</span>
                                </div>
                            )}

                            {/* Desktop Table */}
                            <table className="w-full border-separate border-spacing-0 hidden md:table">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-900/90 backdrop-blur-xl">
                                        {[
                                            { label: 'Status_Node', field: 'status' as SortField, w: '180px' },
                                            { label: 'Hardware_Model', field: 'scaleModel' as SortField },
                                            { label: 'System_Serial', field: 'serialNumber' as SortField },
                                            { label: 'Deployment_Zone', field: 'branch' as SortField },
                                            { label: 'Registry_Date', field: 'timestamp' as SortField },
                                            { label: 'Last_Update', field: 'updatedAt' as SortField },
                                            { label: 'Action_Control', field: null, w: '180px' },
                                        ].map(({ label, field, w }) => (
                                            <th
                                                key={label}
                                                onClick={field ? () => handleSort(field) : undefined}
                                                style={{ width: w }}
                                                className={clsx(
                                                    'h-14 px-6 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 transition-colors',
                                                    field && 'cursor-pointer hover:text-blue-400 select-none'
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {label}
                                                    {field && <SortIcon field={field} />}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.02]">
                                    {pagedItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="group hover:bg-white/[0.02] transition-colors relative"
                                        >
                                            <td className="h-20 px-6">
                                                <span className={clsx(
                                                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border transition-all',
                                                    STATUS_STYLES[item.status]
                                                )}>
                                                    {item.status === 'OPERATIVO' ? <Activity className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                                    {item.status.toUpperCase()}
                                                </span>
                                                {/* Transit Information */}
                                                {item.hasPendingTransfer && item.pendingTransfer && (
                                                    <div className="mt-2 flex items-center gap-2 text-[8px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                                                        <Truck className="w-3 h-3" />
                                                        <span>{item.pendingTransfer.from} » {item.pendingTransfer.to}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6">
                                                <div className="text-[11px] font-black text-white uppercase tracking-wider">{item.scaleModel}</div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{item.weightType}</div>
                                            </td>
                                            <td className="px-6">
                                                <code className="text-[10px] font-bold text-blue-400/80 bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                                                    {item.serialNumber}
                                                </code>
                                            </td>
                                            <td className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {BRANCH_LABELS[item.branch] || item.branch}
                                            </td>
                                            <td className="px-6">
                                                <div className="text-[10px] font-bold text-slate-400">{fmtDate(item.timestamp)}</div>
                                                <div className="text-[9px] font-bold text-slate-600 mt-1">{item.recordedBy || 'SYSTEM'}</div>
                                            </td>
                                            <td className="px-6">
                                                <div className="text-[10px] font-bold text-slate-400">{fmtDate(item.updatedAt || item.timestamp)}</div>
                                                <div className="text-[9px] font-bold text-slate-600 mt-1">{item.updatedBy || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 text-right">
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                                    <button
                                                        onClick={() => setSelectedItem({
                                                            id: item.id,
                                                            serialNumber: item.serialNumber,
                                                            model: item.scaleModel,
                                                            currentStatus: item.status,
                                                            branch: item.branch,
                                                            lastBranch: item.lastBranch
                                                        })}
                                                        className="h-9 px-4 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        EDIT
                                                    </button>
                                                    {isMaster && (
                                                        <button
                                                            onClick={(e) => handleDeleteItem(item, e)}
                                                            disabled={deletingId === item.id}
                                                            className="h-9 w-9 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Grid */}
                            <div className="grid grid-cols-1 gap-4 p-6 md:hidden">
                                {pagedItems.map((item) => (
                                    <div key={item.id} className="p-6 bg-slate-900/50 border border-white/5 rounded-[1.5rem] space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="text-[11px] font-black text-white uppercase tracking-wider">{item.scaleModel}</div>
                                                <code className="text-[9px] font-bold text-blue-400/80">{item.serialNumber}</code>
                                            </div>
                                            <span className={clsx(
                                                'px-2 py-1 rounded-lg text-[8px] font-black tracking-widest border',
                                                STATUS_STYLES[item.status]
                                            )}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                                {BRANCH_LABELS[item.branch] || item.branch}
                                            </span>
                                            <button
                                                onClick={() => setSelectedItem({
                                                    id: item.id,
                                                    serialNumber: item.serialNumber,
                                                    model: item.scaleModel,
                                                    currentStatus: item.status,
                                                    branch: item.branch,
                                                    lastBranch: item.lastBranch
                                                })}
                                                className="h-8 px-4 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                            >
                                                EDIT
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-8 py-4 border-t border-white/5 bg-slate-950/40 flex items-center justify-between shrink-0">
                                <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                    Page {page.toString().padStart(2, '0')} // Total {totalPages.toString().padStart(2, '0')} // Result_Count {filteredItems.length}
                                </div>
                                <div className="flex gap-2">
                                    {[1, page - 1, page + 1, totalPages].map((p, i) => {
                                        const disabled = p < 1 || p > totalPages || p === page;
                                        const icons = ['««', '«', '»', '»»'];
                                        return (
                                            <button
                                                key={i}
                                                disabled={disabled}
                                                onClick={() => setPage(p)}
                                                className="h-9 w-12 flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-20 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold transition-all"
                                            >
                                                {icons[i]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <InventoryStatusModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    user={user}
                    inventoryItem={selectedItem}
                />
            </div>
        </>
    );
}
