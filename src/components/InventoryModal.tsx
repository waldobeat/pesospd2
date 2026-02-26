import React, { useState, useEffect } from 'react';
import { X, Save, Box, AlertCircle, CheckCircle, Loader2, AlertTriangle, Truck } from 'lucide-react';
import { inventoryService, ALL_BRANCHES, BRANCH_LABELS } from '../services/InventoryService';
import { notificationService } from '../services/NotificationService';
import type { InventoryStatus, PendingTransfer } from '../services/InventoryService';
import { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

const SCALE_MODELS: Record<string, string[]> = {
    PESO: ['PD 1', 'PD 2', 'PD 3', 'CHINO', 'OTRO PESO'],
    BALANZA: [
        'CL 5000H COLGANTE',
        'CL 5000H MOSTRADOR',
        'CL 5200 MOSTRADOR',
        'CN 1',
        'OTRA BALANZA',
    ],
};

export function InventoryModal({ isOpen, onClose, user }: InventoryModalProps) {
    const [weightType, setWeightType] = useState('');
    const [scaleModel, setScaleModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [branch, setBranch] = useState('');
    const [status, setStatus] = useState<InventoryStatus>('OPERATIVO');
    const [originalStatus, setOriginalStatus] = useState<InventoryStatus>('OPERATIVO');
    const [description, setDescription] = useState('');
    const [destinationBranch, setDestinationBranch] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingSerial, setIsCheckingSerial] = useState(false);
    const [serialError, setSerialError] = useState<string | null>(null);
    const [serialOk, setSerialOk] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Update Mode States
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);
    const [existingFoundMsg, setExistingFoundMsg] = useState<string | null>(null);

    const userPrefix = user?.email?.split('@')[0] || '';
    const isCentral = userPrefix.toLowerCase() === 'central';

    useEffect(() => {
        if (isOpen) {
            setBranch(isCentral ? '' : userPrefix);
            setWeightType('');
            setScaleModel('');
            setSerialNumber('');
            setStatus('OPERATIVO');
            setDescription('');
            setSerialError(null);
            setFormError(null);
            setSuccess(false);
            setIsUpdateMode(false);
            setExistingId(null);
            setExistingFoundMsg(null);
            setDestinationBranch('');
        }
    }, [isOpen, isCentral, userPrefix]);

    // Debounced serial validation
    useEffect(() => {
        if (!serialNumber.trim() || serialNumber.trim().length < 3) {
            setSerialError(null);
            setSerialOk(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsCheckingSerial(true);
            setSerialError(null);
            setSerialOk(false);
            const result = await inventoryService.isSerialUnique(serialNumber);
            if (!result.unique && result.existingItem) {
                const existing = result.existingItem;
                // Recognize existing item
                setIsUpdateMode(true);
                setExistingId(existing.id);
                setWeightType(existing.weightType);
                setScaleModel(existing.scaleModel);
                setBranch(existing.branch);
                setStatus(existing.status);
                setOriginalStatus(existing.status);
                setDescription(existing.description || '');
                setExistingFoundMsg(
                    `✨ Equipo reconocido: Este serial ya existe. Se han cargado los datos para actualización rápida.`
                );
                setSerialOk(true); // It's "Ok" now because we allow updating
            } else {
                setIsUpdateMode(false);
                setExistingId(null);
                setExistingFoundMsg(null);
                setSerialOk(true);
            }
            setIsCheckingSerial(false);
        }, 600);
        return () => clearTimeout(timer);
    }, [serialNumber]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!weightType || !scaleModel || !serialNumber.trim() || !branch) {
            setFormError('Por favor, complete todos los campos obligatorios.');
            return;
        }
        if (serialError) {
            setFormError('Corrija el serial antes de guardar.');
            return;
        }

        const isTransfer = status === 'ENVIADO' || status === 'TRANSFERIDO';
        if (isTransfer && !destinationBranch) {
            setFormError('Por favor, seleccione una sucursal de destino.');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        const recordedBy = isCentral ? `central → ${branch}` : userPrefix;
        const now = Timestamp.now();

        // Prepare transfer data if applicable
        const pendingTransfer: PendingTransfer | undefined = isTransfer ? {
            from: branch,
            to: destinationBranch,
            initiatedBy: recordedBy,
            initiatedAt: now,
            notes: description.trim() || '',
            originalStatus: isUpdateMode ? originalStatus : status,
        } : undefined;

        try {
            let itemId = existingId;
            if (isUpdateMode && existingId) {
                await inventoryService.updateItem(existingId, {
                    status: isTransfer ? 'EN TRÁNSITO' : status,
                    description: description.trim() || '',
                    updatedBy: recordedBy,
                    hasPendingTransfer: isTransfer,
                    pendingTransfer: isTransfer ? pendingTransfer : null,
                } as any);
                setSuccess(true);
            } else {
                const newId = await inventoryService.addInventory({
                    weightType,
                    scaleModel,
                    serialNumber: serialNumber.trim().toUpperCase(),
                    branch,
                    status: isTransfer ? 'EN TRÁNSITO' : status,
                    recordedBy,
                    description: description.trim() || '',
                    hasPendingTransfer: isTransfer,
                    pendingTransfer: isTransfer ? pendingTransfer : undefined,
                } as any);
                itemId = newId;
                setSuccess(true);
            }

            // Trigger notification
            if (isTransfer && destinationBranch) {
                await notificationService.create({
                    type: 'transfer_request',
                    title: 'Nuevo equipo en camino',
                    message: `Se ha enviado el equipo ${scaleModel} (${serialNumber}) desde ${BRANCH_LABELS[branch] || branch} con destino a su sucursal.`,
                    fromUser: recordedBy,
                    fromBranch: branch,
                    targetBranch: destinationBranch,
                    relatedSerial: serialNumber.trim().toUpperCase(),
                    relatedModel: scaleModel,
                    relatedInventoryId: itemId || undefined,
                });
            }

            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (err: any) {
            setFormError(err.message || 'Error al guardar inventario');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputCls = 'w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-300 font-medium';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 overflow-y-auto">
            <div className="relative w-full max-w-md my-auto">
                {/* Neon Glow Layer */}
                <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500/20 to-blue-500/0 rounded-[2.5rem] blur-2xl opacity-50" />

                <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500">

                    {/* Header */}
                    <div className="relative flex items-center justify-between p-7 border-b border-white/5">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner group">
                                <Box className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight leading-none uppercase">
                                    {isUpdateMode ? 'Update_Asset' : 'New_Registration'}
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                                    {isUpdateMode ? 'Hardware System Update' : 'SISDEPE Weigher DB v2.0'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all duration-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-7 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

                        {/* Alerts */}
                        {formError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 text-xs font-bold leading-relaxed animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}
                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in zoom-in-95">
                                <CheckCircle className="w-5 h-5" />
                                {isUpdateMode ? 'ASSET_STATUS_UPDATED' : 'ASSET_REGISTERED_SUCCESSFULLY'}
                            </div>
                        )}
                        {existingFoundMsg && !success && (
                            <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 p-4 rounded-2xl flex items-start gap-3 text-xs font-bold animate-pulse">
                                <Box className="w-5 h-5 flex-shrink-0" />
                                <span>{existingFoundMsg}</span>
                            </div>
                        )}

                        {/* Tipo de Peso */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Tipo de Equipo *</label>
                            <select
                                value={weightType}
                                onChange={(e) => { setWeightType(e.target.value); setScaleModel(''); }}
                                className={inputCls}
                                disabled={isSubmitting || success || isUpdateMode}
                            >
                                <option value="">-- Seleccionar Tipo --</option>
                                <option value="PESO">PESO</option>
                                <option value="BALANZA">BALANZA</option>
                            </select>
                        </div>

                        {/* Modelo */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Modelo *</label>
                            <select
                                value={scaleModel}
                                onChange={(e) => setScaleModel(e.target.value)}
                                className={inputCls}
                                disabled={isSubmitting || success || !weightType || isUpdateMode}
                            >
                                <option value="">-- Seleccionar Modelo --</option>
                                {(SCALE_MODELS[weightType] || []).map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Serial */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Número de Serial *</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={serialNumber}
                                    onChange={(e) => setSerialNumber(e.target.value)}
                                    className={`${inputCls} pr-10 font-mono ${serialError ? 'border-red-500/60' : serialOk ? 'border-green-500/60' : ''}`}
                                    placeholder="SN-XXXX"
                                    disabled={isSubmitting || success}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {isCheckingSerial && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
                                    {!isCheckingSerial && serialOk && <CheckCircle className="w-4 h-4 text-green-400" />}
                                    {!isCheckingSerial && serialError && <AlertTriangle className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>
                            {serialError && (
                                <p className="text-xs text-red-400 pl-1">{serialError}</p>
                            )}
                            {serialOk && !serialError && (
                                <p className="text-xs text-green-400 pl-1">Serial disponible ✓</p>
                            )}
                        </div>

                        {/* Sucursal */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Sucursal *</label>
                            {isCentral ? (
                                <select
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className={inputCls}
                                    disabled={isSubmitting || success}
                                >
                                    <option value="">-- Seleccionar Sucursal --</option>
                                    {ALL_BRANCHES.map((b) => (
                                        <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={BRANCH_LABELS[branch] || branch}
                                        readOnly
                                        className="w-full bg-slate-900/40 border border-white/5 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed font-black text-xs tracking-widest uppercase"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 rounded-xl" />
                                </div>
                            )}
                            {isUpdateMode && !isCentral && (
                                <p className="text-[10px] text-yellow-500/70 pl-1 mt-1 font-medium">
                                    ⚠️ El equipo pertenece a la sucursal original: {(BRANCH_LABELS[branch] || branch).toUpperCase()}
                                </p>
                            )}
                        </div>

                        {/* Estatus Inicial */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">
                                {isUpdateMode ? 'Nuevo Estatus *' : 'Estatus Inicial *'}
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                                className={inputCls}
                                disabled={isSubmitting || success}
                            >
                                <option value="OPERATIVO">OPERATIVO</option>
                                <option value="DAÑADO">DAÑADO</option>
                                <option value="EN TALLER">EN TALLER</option>
                                <option value="REPARANDO">REPARANDO</option>
                                <option value="REPARADO">REPARADO</option>
                                <option value="EN ESPERA">EN ESPERA</option>
                                <option value="ENVIADO">ENVIADO</option>
                                <option value="TRANSFERIDO">TRANSFERIDO</option>
                            </select>
                            <p className="text-[10px] text-white/25 pl-1">Estado físico/lógico actual del equipo al momento del registro.</p>
                        </div>

                        {/* Sucursal Destino (Conditional) */}
                        {(status === 'ENVIADO' || status === 'TRANSFERIDO') && (
                            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
                                <label className="text-xs font-bold text-yellow-500 uppercase tracking-wide flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5" />
                                    Sucursal Destino *
                                </label>
                                <select
                                    value={destinationBranch}
                                    onChange={(e) => setDestinationBranch(e.target.value)}
                                    className={`${inputCls} border-yellow-500/30 focus:border-yellow-500`}
                                    disabled={isSubmitting || success}
                                >
                                    <option value="">-- Seleccionar Destino --</option>
                                    {Object.keys(BRANCH_LABELS)
                                        .filter(b => b !== branch) // Don't send to self
                                        .map((b) => (
                                            <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                                        ))}
                                </select>
                                <p className="text-[10px] text-yellow-500/50 pl-1">
                                    El equipo pasará a estado <strong>EN TRÁNSITO</strong> y se notificará a la sucursal de destino.
                                </p>
                            </div>
                        )}

                        {/* Descripción */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">
                                Observaciones <span className="normal-case font-normal text-white/20">(Opcional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className={`${inputCls} resize-none`}
                                placeholder="Detalles adicionales del equipo..."
                                rows={2}
                                disabled={isSubmitting || success}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4 border-t border-white/5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting || success}
                                className="flex-1 h-14 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-black text-xs tracking-[0.2em] transition-all duration-300 border border-white/5"
                            >
                                CANCEL
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || success || !!serialError || isCheckingSerial}
                                className="flex-1 h-14 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 text-slate-950 rounded-2xl font-black text-xs tracking-[0.2em] transition-all duration-300 shadow-[0_0_20px_rgba(8,145,178,0.25)] flex items-center justify-center gap-3 active:scale-95"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {isUpdateMode ? 'COMMIT_UPDATE' : 'SUBMIT_DATA'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
