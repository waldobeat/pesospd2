import React, { useState, useEffect } from 'react';
import { X, Save, Box, AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { inventoryService, ALL_BRANCHES, BRANCH_LABELS } from '../services/InventoryService';
import type { InventoryStatus } from '../services/InventoryService';
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
    const [description, setDescription] = useState('');

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
            setSerialOk(false);
            setFormError(null);
            setSuccess(false);
            setIsUpdateMode(false);
            setExistingId(null);
            setExistingFoundMsg(null);
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

        setIsSubmitting(true);
        setFormError(null);

        const recordedBy = isCentral ? `central → ${branch}` : userPrefix;

        try {
            if (isUpdateMode && existingId) {
                await inventoryService.updateItem(existingId, {
                    status,
                    description: description.trim() || undefined,
                    updatedBy: recordedBy,
                } as any);
                setSuccess(true);
            } else {
                await inventoryService.addInventory({
                    weightType,
                    scaleModel,
                    serialNumber: serialNumber.trim().toUpperCase(),
                    branch,
                    status,
                    recordedBy,
                    description: description.trim() || undefined,
                } as any);
                setSuccess(true);
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

    const inputCls = 'w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none placeholder-white/20';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Box className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white leading-tight">
                                {isUpdateMode ? 'Actualización de Equipo' : 'Registro de Nuevo Equipo'}
                            </h2>
                            <p className="text-xs text-white/30">
                                {isUpdateMode ? 'El serial ya existe, actualizando estatus' : 'Inventario físico SISDEPE'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">

                    {/* Alerts */}
                    {formError && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-start gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{formError}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            {isUpdateMode ? 'Estatus actualizado correctamente.' : 'Equipo registrado correctamente.'}
                        </div>
                    )}
                    {existingFoundMsg && !success && (
                        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-3 rounded-lg flex items-start gap-2 text-sm animate-pulse">
                            <Box className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                            <input
                                type="text"
                                value={BRANCH_LABELS[branch] || branch}
                                readOnly
                                className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-4 py-3 text-white/40 cursor-not-allowed font-medium"
                            />
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
                            <option value="EN ESPERA">EN ESPERA</option>
                            <option value="ENVIADO">ENVIADO</option>
                            <option value="TRANSFERIDO">TRANSFERIDO</option>
                        </select>
                        <p className="text-[10px] text-white/25 pl-1">Estado físico/lógico actual del equipo al momento del registro.</p>
                    </div>

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
                            disabled={isSubmitting || success || !!serialError || isCheckingSerial}
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    {isUpdateMode ? 'ACTUALIZAR ESTATUS' : 'GUARDAR'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
