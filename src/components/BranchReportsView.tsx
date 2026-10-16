import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
    FIXED_BRANCHES,
    FIXED_PESOS_MODELS,
    FIXED_BALANZAS_MODELS,
    type BranchId,
    type PesoModel,
    type BalanzaModel,
    type BranchReportData,
    type ModelEquipmentData,
    type AuditLogItem,
    branchReportService,
    calculateCategoryTotals,
    calculateBranchTotals,
    calculateModelTotal,
    createDefaultBranchReport
} from '../services/BranchReportService';
import { exportReportsToPDF, exportReportsToCSV } from '../utils/reportExport';
import {
    Scale,
    FileSpreadsheet,
    FileDown,
    Printer,
    LogOut,
    CheckCircle2,
    Wrench,
    AlertTriangle,
    Building2,
    Save,
    RotateCcw,
    Layers,
    History,
    Calendar,
    UserCheck,
    Plus,
    Minus,
    ArrowLeft,
    Sparkles,
    Check
} from 'lucide-react';

interface BranchReportsViewProps {
    user: User;
    onNavigateBack: () => void;
}

export const BranchReportsView: React.FC<BranchReportsViewProps> = ({ user, onNavigateBack }) => {
    // Report data for all 3 branches
    const [reports, setReports] = useState<Record<BranchId, BranchReportData>>(() => {
        return FIXED_BRANCHES.reduce((acc, b) => {
            acc[b.id] = createDefaultBranchReport(b.id, b.name);
            return acc;
        }, {} as Record<BranchId, BranchReportData>);
    });

    const [activeTab, setActiveTab] = useState<'CONSOLIDADO' | BranchId | 'AUDIT'>('CONSOLIDADO');
    const [editData, setEditData] = useState<BranchReportData | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Subscribe to Firestore changes in real time
    useEffect(() => {
        const unsubscribe = branchReportService.subscribeAllReports((incoming) => {
            setReports(incoming);
        });
        const unsubAudit = branchReportService.subscribeAuditLog((logs) => {
            setAuditLogs(logs);
        });

        return () => {
            unsubscribe();
            unsubAudit();
        };
    }, []);

    // When activeTab changes to a specific branch, load its data into editData
    useEffect(() => {
        if (activeTab !== 'CONSOLIDADO' && activeTab !== 'AUDIT') {
            const current = reports[activeTab] || createDefaultBranchReport(activeTab, getBranchName(activeTab));
            setEditData(JSON.parse(JSON.stringify(current)));
            setSaveSuccess(false);
            setSaveError(null);
        } else {
            setEditData(null);
        }
    }, [activeTab, reports]);

    const getBranchName = (id: BranchId): string => {
        return FIXED_BRANCHES.find(b => b.id === id)?.name || id;
    };

    // Calculate Global Totals across all 3 branches
    const globalTotals = useMemo(() => {
        let operativos = 0;
        let enTaller = 0;
        let danados = 0;
        let pesosCount = 0;
        let balanzasCount = 0;

        FIXED_BRANCHES.forEach(b => {
            const rep = reports[b.id];
            if (rep) {
                const bTotals = calculateBranchTotals(rep);
                operativos += bTotals.operativos;
                enTaller += bTotals.enTaller;
                danados += bTotals.danados;

                const pTotals = calculateCategoryTotals(rep.pesos);
                pesosCount += pTotals.total;

                const balTotals = calculateCategoryTotals(rep.balanzas);
                balanzasCount += balTotals.total;
            }
        });

        const total = operativos + enTaller + danados;
        const rate = total > 0 ? Math.round((operativos / total) * 100) : 0;

        return { operativos, enTaller, danados, total, rate, pesosCount, balanzasCount };
    }, [reports]);

    // Update field in current branch editing
    const handleModelValueChange = (
        category: 'pesos' | 'balanzas',
        model: string,
        field: keyof ModelEquipmentData,
        value: any
    ) => {
        if (!editData) return;

        setEditData(prev => {
            if (!prev) return prev;
            const currentCat = { ...prev[category] };
            const currentModelData = { ...(currentCat[model as any] || { operativos: 0, enTaller: 0, danados: 0, notas: '' }) };

            if (field === 'notas') {
                currentModelData.notas = String(value);
            } else {
                const num = Math.max(0, parseInt(value, 10) || 0);
                (currentModelData as any)[field] = num;
            }

            return {
                ...prev,
                [category]: {
                    ...currentCat,
                    [model]: currentModelData
                }
            };
        });
    };

    const handleIncrement = (category: 'pesos' | 'balanzas', model: string, field: 'operativos' | 'enTaller' | 'danados', delta: number) => {
        if (!editData) return;
        const currentVal = Number(editData[category]?.[model as any]?.[field]) || 0;
        const nextVal = Math.max(0, currentVal + delta);
        handleModelValueChange(category, model, field, nextVal);
    };

    // Save changes for current branch
    const handleSaveCurrentBranch = async () => {
        if (!editData || activeTab === 'CONSOLIDADO' || activeTab === 'AUDIT') return;

        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            await branchReportService.saveReport(
                activeTab,
                editData,
                user.email || 'desconocido@sisdepe'
            );
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err: any) {
            console.error('Error al guardar reporte:', err);
            setSaveError('No se pudo guardar el reporte en la base de datos. Intente de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    // Format last updated time
    const formatTimestamp = (ts: any): string => {
        if (!ts) return 'Sin registros';
        try {
            if (ts.toDate) {
                return ts.toDate().toLocaleString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            if (ts.seconds) {
                return new Date(ts.seconds * 1000).toLocaleString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return new Date(ts).toLocaleString('es-VE');
        } catch (e) {
            return 'Reciente';
        }
    };

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans pb-16 selection:bg-cyan-500 selection:text-white">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-3.5 shadow-xl">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    {/* Brand & Title */}
                    <div className="flex items-center gap-3.5">
                        <button
                            onClick={onNavigateBack}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="Regresar a la balanza principal"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">SISDEPE Principal</span>
                        </button>

                        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
                                <Scale className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base font-black tracking-tight text-white leading-none">
                                        SISDEPE
                                    </h1>
                                    <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                                        Reportes
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Control de Equipos: Tucacas • San Diego • San Juan
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Tools */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => exportReportsToPDF(reports, user.email || '')}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Descargar Reporte Ejecutivo en PDF"
                        >
                            <FileDown className="w-4 h-4 text-rose-400" />
                            <span className="hidden md:inline">PDF</span>
                        </button>

                        <button
                            onClick={() => exportReportsToCSV(reports)}
                            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            title="Descargar Planilla en Excel/CSV"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                            <span className="hidden md:inline">CSV</span>
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all hidden sm:flex items-center gap-1.5"
                            title="Imprimir Pantalla"
                        >
                            <Printer className="w-4 h-4 text-sky-400" />
                        </button>

                        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                        {/* User Tag */}
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-[11px] font-bold text-slate-300 truncate max-w-[160px]">
                                {user.email?.split('@')[0]}
                            </span>
                            <span className="text-[9px] text-slate-500 font-semibold">
                                {user.email}
                            </span>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={() => signOut(auth)}
                            className="p-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="Cerrar Sesión de Firebase"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl w-full mx-auto px-4 lg:px-8 pt-6 flex-1 flex flex-col gap-6">

                {/* Global KPI Stats Cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    {/* Operativos */}
                    <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                Operativos en Tienda
                            </span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                {globalTotals.rate}%
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                {globalTotals.operativos}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">equipos listos</span>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 font-medium">
                            En las 3 sucursales
                        </div>
                    </div>

                    {/* En Taller */}
                    <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <Wrench className="w-4 h-4" />
                                En Taller
                            </span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                                Servicio
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                {globalTotals.enTaller}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">en reparación</span>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 font-medium">
                            Enviados o bajo revisión
                        </div>
                    </div>

                    {/* Dañados en Tienda */}
                    <div className="bg-slate-900/60 border border-red-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                Dañados en Tienda
                            </span>
                            <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded-full">
                                Inoperativos
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                {globalTotals.danados}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">por retirar</span>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 font-medium">
                            Requieren traslado al taller
                        </div>
                    </div>

                    {/* Gran Total */}
                    <div className="bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                                <Layers className="w-4 h-4" />
                                Gran Total
                            </span>
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full">
                                Inventario
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                {globalTotals.total}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">equipos totales</span>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 font-medium flex gap-2">
                            <span>Pesos: <b className="text-slate-300">{globalTotals.pesosCount}</b></span>
                            <span>•</span>
                            <span>Balanzas: <b className="text-slate-300">{globalTotals.balanzasCount}</b></span>
                        </div>
                    </div>
                </section>

                {/* Main Tabs Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab('CONSOLIDADO')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'CONSOLIDADO'
                            ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        Consolidado General (3 Sucursales)
                    </button>

                    {FIXED_BRANCHES.map(branch => {
                        const bReport = reports[branch.id];
                        const bTotals = bReport ? calculateBranchTotals(bReport) : { operativos: 0, total: 0 };
                        const isActive = activeTab === branch.id;

                        return (
                            <button
                                key={branch.id}
                                onClick={() => setActiveTab(branch.id)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                                    }`}
                            >
                                <Building2 className="w-4 h-4 text-cyan-400" />
                                <span>{branch.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${isActive ? 'bg-black/30 text-white' : 'bg-slate-700 text-slate-300'
                                    }`}>
                                    {bTotals.total}
                                </span>
                            </button>
                        );
                    })}

                    <button
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'AUDIT'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                    >
                        <History className="w-4 h-4" />
                        Historial de Auditoría
                    </button>
                </div>

                {/* TAB 1: CONSOLIDADO GENERAL */}
                {activeTab === 'CONSOLIDADO' && (
                    <div className="flex flex-col gap-6">
                        {/* Section Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                            <div>
                                <h2 className="text-base font-black text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-cyan-400" />
                                    Matriz Comparativa de Sucursales
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Resumen en vivo por modelo fijo de Pesos y Balanzas en Tucacas, San Diego y San Juan
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Op: Operativos
                                </span>
                                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Tal: En Taller
                                </span>
                                <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Dañ: Dañados
                                </span>
                            </div>
                        </div>

                        {/* MATRIZ DE PESOS */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                            <div className="bg-slate-800/80 px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                        1. PESOS (Modelos Fijos: PD 2, PD 1, OTRO)
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">
                                    Control Operativo
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                                        <tr>
                                            <th className="py-3 px-4">Modelo Fijo</th>
                                            {FIXED_BRANCHES.map(b => (
                                                <th key={b.id} colSpan={4} className="py-3 px-2 text-center border-l border-slate-800">
                                                    <span className="text-white font-black">{b.name}</span>
                                                    <div className="grid grid-cols-4 gap-1 text-[9px] text-slate-500 font-normal mt-1">
                                                        <span>Op</span>
                                                        <span>Tal</span>
                                                        <span>Dañ</span>
                                                        <span className="font-bold text-slate-300">Total</span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="py-3 px-4 text-center border-l border-slate-800 font-black text-white">
                                                Total Global
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {FIXED_PESOS_MODELS.map(model => {
                                            let modelGlobalTotal = 0;
                                            return (
                                                <tr key={model} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-slate-200">
                                                        <span className="inline-block px-2.5 py-1 bg-slate-800 text-cyan-300 font-mono font-black rounded-lg border border-slate-700">
                                                            {model}
                                                        </span>
                                                    </td>

                                                    {FIXED_BRANCHES.map(b => {
                                                        const item = reports[b.id]?.pesos?.[model] || { operativos: 0, enTaller: 0, danados: 0 };
                                                        const mTotal = calculateModelTotal(item);
                                                        modelGlobalTotal += mTotal;

                                                        return (
                                                            <React.Fragment key={b.id}>
                                                                <td className="py-3 px-2 text-center border-l border-slate-800/80 font-mono text-emerald-400 font-bold">
                                                                    {item.operativos}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono text-amber-400 font-bold">
                                                                    {item.enTaller}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono text-red-400 font-bold">
                                                                    {item.danados}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono font-black text-white bg-slate-800/20">
                                                                    {mTotal}
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    <td className="py-3 px-4 text-center border-l border-slate-800 font-mono font-black text-cyan-400 bg-cyan-950/20 text-sm">
                                                        {modelGlobalTotal}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Subtotal Pesos Row */}
                                        <tr className="bg-slate-800/60 font-black text-slate-200 border-t-2 border-slate-700">
                                            <td className="py-3 px-4 uppercase tracking-wider text-[11px] text-cyan-400">
                                                SUBTOTAL PESOS
                                            </td>
                                            {FIXED_BRANCHES.map(b => {
                                                const catTotals = calculateCategoryTotals(reports[b.id]?.pesos || {});
                                                return (
                                                    <React.Fragment key={b.id}>
                                                        <td className="py-3 px-2 text-center border-l border-slate-700 font-mono text-emerald-400">
                                                            {catTotals.operativos}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-amber-400">
                                                            {catTotals.enTaller}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-red-400">
                                                            {catTotals.danados}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-white bg-slate-900/60">
                                                            {catTotals.total}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-center border-l border-slate-700 font-mono text-cyan-300 bg-cyan-900/30 text-sm">
                                                {globalTotals.pesosCount}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* MATRIZ DE BALANZAS */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                            <div className="bg-slate-800/80 px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-cyan-500" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                        2. BALANZAS (Modelos Fijos: CAS CL5200, CL 5000, CL 5000H, N1, OTRAS)
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">
                                    Control Operativo
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                                        <tr>
                                            <th className="py-3 px-4">Modelo Fijo</th>
                                            {FIXED_BRANCHES.map(b => (
                                                <th key={b.id} colSpan={4} className="py-3 px-2 text-center border-l border-slate-800">
                                                    <span className="text-white font-black">{b.name}</span>
                                                    <div className="grid grid-cols-4 gap-1 text-[9px] text-slate-500 font-normal mt-1">
                                                        <span>Op</span>
                                                        <span>Tal</span>
                                                        <span>Dañ</span>
                                                        <span className="font-bold text-slate-300">Total</span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="py-3 px-4 text-center border-l border-slate-800 font-black text-white">
                                                Total Global
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {FIXED_BALANZAS_MODELS.map(model => {
                                            let modelGlobalTotal = 0;
                                            return (
                                                <tr key={model} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-slate-200">
                                                        <span className="inline-block px-2.5 py-1 bg-slate-800 text-blue-300 font-mono font-black rounded-lg border border-slate-700">
                                                            {model}
                                                        </span>
                                                    </td>

                                                    {FIXED_BRANCHES.map(b => {
                                                        const item = reports[b.id]?.balanzas?.[model] || { operativos: 0, enTaller: 0, danados: 0 };
                                                        const mTotal = calculateModelTotal(item);
                                                        modelGlobalTotal += mTotal;

                                                        return (
                                                            <React.Fragment key={b.id}>
                                                                <td className="py-3 px-2 text-center border-l border-slate-800/80 font-mono text-emerald-400 font-bold">
                                                                    {item.operativos}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono text-amber-400 font-bold">
                                                                    {item.enTaller}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono text-red-400 font-bold">
                                                                    {item.danados}
                                                                </td>
                                                                <td className="py-3 px-2 text-center font-mono font-black text-white bg-slate-800/20">
                                                                    {mTotal}
                                                                </td>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    <td className="py-3 px-4 text-center border-l border-slate-800 font-mono font-black text-cyan-400 bg-cyan-950/20 text-sm">
                                                        {modelGlobalTotal}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Subtotal Balanzas Row */}
                                        <tr className="bg-slate-800/60 font-black text-slate-200 border-t-2 border-slate-700">
                                            <td className="py-3 px-4 uppercase tracking-wider text-[11px] text-cyan-400">
                                                SUBTOTAL BALANZAS
                                            </td>
                                            {FIXED_BRANCHES.map(b => {
                                                const catTotals = calculateCategoryTotals(reports[b.id]?.balanzas || {});
                                                return (
                                                    <React.Fragment key={b.id}>
                                                        <td className="py-3 px-2 text-center border-l border-slate-700 font-mono text-emerald-400">
                                                            {catTotals.operativos}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-amber-400">
                                                            {catTotals.enTaller}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-red-400">
                                                            {catTotals.danados}
                                                        </td>
                                                        <td className="py-3 px-2 text-center font-mono text-white bg-slate-900/60">
                                                            {catTotals.total}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="py-3 px-4 text-center border-l border-slate-700 font-mono text-cyan-300 bg-cyan-900/30 text-sm">
                                                {globalTotals.balanzasCount}
                                            </td>
                                        </tr>

                                        {/* GRAN TOTAL SUCURSAL ROW */}
                                        <tr className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 font-black text-white border-t-2 border-cyan-500/50">
                                            <td className="py-4 px-4 uppercase tracking-wider text-xs text-cyan-300">
                                                GRAN TOTAL TIENDA
                                            </td>
                                            {FIXED_BRANCHES.map(b => {
                                                const bTotals = calculateBranchTotals(reports[b.id] || createDefaultBranchReport(b.id, b.name));
                                                return (
                                                    <React.Fragment key={b.id}>
                                                        <td className="py-4 px-2 text-center border-l border-slate-700 font-mono text-emerald-400 text-sm">
                                                            {bTotals.operativos}
                                                        </td>
                                                        <td className="py-4 px-2 text-center font-mono text-amber-400 text-sm">
                                                            {bTotals.enTaller}
                                                        </td>
                                                        <td className="py-4 px-2 text-center font-mono text-red-400 text-sm">
                                                            {bTotals.danados}
                                                        </td>
                                                        <td className="py-4 px-2 text-center font-mono text-white bg-slate-950 text-sm font-black">
                                                            {bTotals.total}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="py-4 px-4 text-center border-l border-cyan-500/50 font-mono font-black text-cyan-300 bg-cyan-950/40 text-base">
                                                {globalTotals.total}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Quick Jump Buttons to edit each branch */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {FIXED_BRANCHES.map(b => {
                                const bRep = reports[b.id];
                                const bTotals = bRep ? calculateBranchTotals(bRep) : { operativos: 0, enTaller: 0, danados: 0, total: 0, operativityRate: 0 };

                                return (
                                    <div
                                        key={b.id}
                                        className="bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 group"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-base font-black text-white flex items-center gap-2">
                                                    <Building2 className="w-5 h-5 text-cyan-400" />
                                                    {b.name}
                                                </h4>
                                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                                                    {bTotals.operativityRate}% Op.
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
                                                    <span className="text-[9px] uppercase font-bold text-emerald-400 block">Op</span>
                                                    <span className="text-base font-mono font-black text-emerald-300">{bTotals.operativos}</span>
                                                </div>
                                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                                                    <span className="text-[9px] uppercase font-bold text-amber-400 block">Taller</span>
                                                    <span className="text-base font-mono font-black text-amber-300">{bTotals.enTaller}</span>
                                                </div>
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2">
                                                    <span className="text-[9px] uppercase font-bold text-red-400 block">Dañados</span>
                                                    <span className="text-base font-mono font-black text-red-300">{bTotals.danados}</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 text-[11px] text-slate-400">
                                                Último registro: <b className="text-slate-300">{formatTimestamp(bRep?.updatedAt)}</b>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setActiveTab(b.id)}
                                            className="w-full py-2.5 bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-cyan-600/20"
                                        >
                                            <Wrench className="w-3.5 h-3.5" />
                                            Actualizar Inventario {b.name}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB 2, 3, 4: EDITABLE BRANCH VIEW (TUCACAS, SAN DIEGO, SAN JUAN) */}
                {activeTab !== 'CONSOLIDADO' && activeTab !== 'AUDIT' && editData && (
                    <div className="flex flex-col gap-6">
                        {/* Branch Banner */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-black text-white tracking-tight">
                                                Sucursal {getBranchName(activeTab)}
                                            </h2>
                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                Sucursal Fija
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Actualizado por: <b className="text-slate-300">{editData.updatedBy || 'Sin registrar'}</b> • Fecha: <b className="text-slate-300">{formatTimestamp(editData.updatedAt)}</b>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Live branch summary pill */}
                            {(() => {
                                const currentTotals = calculateBranchTotals(editData);
                                return (
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-center">
                                            <span className="text-[10px] text-slate-400 block font-bold">TOTAL TIENDA</span>
                                            <span className="text-base font-black text-white font-mono">{currentTotals.total}</span>
                                        </div>
                                        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3 py-1.5 text-center">
                                            <span className="text-[10px] text-emerald-400 block font-bold">OPERATIVOS</span>
                                            <span className="text-base font-black text-emerald-300 font-mono">{currentTotals.operativos}</span>
                                        </div>
                                        <div className="bg-amber-950/40 border border-amber-800/40 rounded-xl px-3 py-1.5 text-center">
                                            <span className="text-[10px] text-amber-400 block font-bold">TALLER</span>
                                            <span className="text-base font-black text-amber-300 font-mono">{currentTotals.enTaller}</span>
                                        </div>
                                        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-3 py-1.5 text-center">
                                            <span className="text-[10px] text-red-400 block font-bold">DAÑADOS</span>
                                            <span className="text-base font-black text-red-300 font-mono">{currentTotals.danados}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Status messages */}
                        {saveSuccess && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm animate-in fade-in duration-300">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                <div>
                                    <span className="font-bold">¡Reporte guardado con éxito!</span>
                                    <p className="text-xs text-emerald-300/80">Los datos de {getBranchName(activeTab)} fueron actualizados en la base de datos de Firebase.</p>
                                </div>
                            </div>
                        )}

                        {saveError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-sm animate-in fade-in duration-300">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <span>{saveError}</span>
                            </div>
                        )}

                        {/* SECTION 1: PESOS */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center font-black">
                                        P
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                            Pesos - Modelos Fijos
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Modelos autorizados: PD 2, PD 1, OTRO
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                                    Subtotal Pesos: {calculateCategoryTotals(editData.pesos).total}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {FIXED_PESOS_MODELS.map(model => {
                                    const modelData = editData.pesos[model] || { operativos: 0, enTaller: 0, danados: 0, notas: '' };
                                    const mTotal = calculateModelTotal(modelData);

                                    return (
                                        <div
                                            key={model}
                                            className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-black font-mono rounded-lg">
                                                        MODELO: {model}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                                        Peso Electrónico
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400">Total Modelo:</span>
                                                    <span className="text-sm font-mono font-black text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                                                        {mTotal}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quantity Inputs */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {/* Operativos */}
                                                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-emerald-400 mb-1.5 flex items-center justify-between">
                                                        <span>Operativos en Tienda</span>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'operativos', -1)}
                                                            className="w-8 h-8 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.operativos}
                                                            onChange={(e) => handleModelValueChange('pesos', model, 'operativos', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-emerald-500/30 rounded-lg py-1.5 px-2 text-center text-emerald-300 font-mono font-black text-base outline-none focus:border-emerald-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'operativos', 1)}
                                                            className="w-8 h-8 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* En Taller */}
                                                <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-amber-400 mb-1.5 flex items-center justify-between">
                                                        <span>En Taller</span>
                                                        <Wrench className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'enTaller', -1)}
                                                            className="w-8 h-8 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.enTaller}
                                                            onChange={(e) => handleModelValueChange('pesos', model, 'enTaller', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-amber-500/30 rounded-lg py-1.5 px-2 text-center text-amber-300 font-mono font-black text-base outline-none focus:border-amber-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'enTaller', 1)}
                                                            className="w-8 h-8 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Dañados en Tienda */}
                                                <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-red-400 mb-1.5 flex items-center justify-between">
                                                        <span>Dañados en Tienda</span>
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'danados', -1)}
                                                            className="w-8 h-8 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.danados}
                                                            onChange={(e) => handleModelValueChange('pesos', model, 'danados', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-red-500/30 rounded-lg py-1.5 px-2 text-center text-red-300 font-mono font-black text-base outline-none focus:border-red-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('pesos', model, 'danados', 1)}
                                                            className="w-8 h-8 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes for this model */}
                                            <div className="mt-2.5">
                                                <input
                                                    type="text"
                                                    value={modelData.notas || ''}
                                                    onChange={(e) => handleModelValueChange('pesos', model, 'notas', e.target.value)}
                                                    placeholder="Observación o detalle de fallas (opcional)..."
                                                    className="w-full bg-slate-900/80 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-slate-600"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SECTION 2: BALANZAS */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-cyan-500/20 text-cyan-400 rounded-lg flex items-center justify-center font-black">
                                        B
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                            Balanzas - Modelos Fijos
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Modelos autorizados: CAS CL5200, CL 5000, CL 5000H, N1, OTRAS
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                                    Subtotal Balanzas: {calculateCategoryTotals(editData.balanzas).total}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {FIXED_BALANZAS_MODELS.map(model => {
                                    const modelData = editData.balanzas[model] || { operativos: 0, enTaller: 0, danados: 0, notas: '' };
                                    const mTotal = calculateModelTotal(modelData);

                                    return (
                                        <div
                                            key={model}
                                            className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-700"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-xs font-black font-mono rounded-lg">
                                                        MODELO: {model}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                                        Balanza Comercial
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400">Total Modelo:</span>
                                                    <span className="text-sm font-mono font-black text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                                                        {mTotal}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quantity Inputs */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {/* Operativos */}
                                                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-emerald-400 mb-1.5 flex items-center justify-between">
                                                        <span>Operativos en Tienda</span>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'operativos', -1)}
                                                            className="w-8 h-8 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.operativos}
                                                            onChange={(e) => handleModelValueChange('balanzas', model, 'operativos', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-emerald-500/30 rounded-lg py-1.5 px-2 text-center text-emerald-300 font-mono font-black text-base outline-none focus:border-emerald-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'operativos', 1)}
                                                            className="w-8 h-8 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* En Taller */}
                                                <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-amber-400 mb-1.5 flex items-center justify-between">
                                                        <span>En Taller</span>
                                                        <Wrench className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'enTaller', -1)}
                                                            className="w-8 h-8 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.enTaller}
                                                            onChange={(e) => handleModelValueChange('balanzas', model, 'enTaller', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-amber-500/30 rounded-lg py-1.5 px-2 text-center text-amber-300 font-mono font-black text-base outline-none focus:border-amber-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'enTaller', 1)}
                                                            className="w-8 h-8 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Dañados en Tienda */}
                                                <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-3 flex flex-col justify-between">
                                                    <label className="text-[11px] font-bold uppercase text-red-400 mb-1.5 flex items-center justify-between">
                                                        <span>Dañados en Tienda</span>
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'danados', -1)}
                                                            className="w-8 h-8 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={modelData.danados}
                                                            onChange={(e) => handleModelValueChange('balanzas', model, 'danados', e.target.value)}
                                                            className="flex-1 bg-slate-900 border border-red-500/30 rounded-lg py-1.5 px-2 text-center text-red-300 font-mono font-black text-base outline-none focus:border-red-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleIncrement('balanzas', model, 'danados', 1)}
                                                            className="w-8 h-8 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 flex items-center justify-center font-black transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes for this model */}
                                            <div className="mt-2.5">
                                                <input
                                                    type="text"
                                                    value={modelData.notas || ''}
                                                    onChange={(e) => handleModelValueChange('balanzas', model, 'notas', e.target.value)}
                                                    placeholder="Observación o detalle de fallas (opcional)..."
                                                    className="w-full bg-slate-900/80 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-slate-600"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* General Branch Notes */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                            <label className="block text-xs font-bold uppercase text-slate-300 mb-2">
                                Observaciones Generales de la Sucursal {getBranchName(activeTab)}
                            </label>
                            <textarea
                                rows={3}
                                value={editData.generalNotes || ''}
                                onChange={(e) => setEditData(prev => prev ? { ...prev, generalNotes: e.target.value } : null)}
                                placeholder="Escriba comentarios sobre el estado general de la tienda, auditorías pendientes, traslados programados..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-all resize-none"
                            />
                        </div>

                        {/* Action Footer Button */}
                        <div className="sticky bottom-4 z-30 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Building2 className="w-4 h-4 text-cyan-400" />
                                <span>Guardando en: <b className="text-white">{getBranchName(activeTab)}</b></span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = reports[activeTab] || createDefaultBranchReport(activeTab, getBranchName(activeTab));
                                        setEditData(JSON.parse(JSON.stringify(current)));
                                    }}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Revertir Cambios
                                </button>

                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={handleSaveCurrentBranch}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Guardando en Firebase...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Guardar Reporte {getBranchName(activeTab)}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: AUDIT LOGS */}
                {activeTab === 'AUDIT' && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-black text-white flex items-center gap-2">
                                    <History className="w-4 h-4 text-violet-400" />
                                    Bitácora de Auditoría y Modificaciones
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Registro cronológico de quién actualizó cada sucursal
                                </p>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                                {auditLogs.length} eventos registrados
                            </span>
                        </div>

                        {auditLogs.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 text-xs">
                                No hay modificaciones registradas todavía. Cuando guardes un reporte, aparecerá aquí.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {auditLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-white">{log.branchName}</span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                                        {log.updatedBy}
                                                    </span>
                                                </div>
                                                <p className="text-slate-300 mt-1 font-medium">
                                                    {log.summary}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-slate-500 text-[11px] font-mono sm:text-right flex-shrink-0">
                                            {formatTimestamp(log.timestamp)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
