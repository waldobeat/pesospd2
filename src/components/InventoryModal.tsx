import React, { useState, useEffect } from 'react';
import { X, Save, Box, AlertCircle } from 'lucide-react';
import { inventoryService, InventoryStatus } from '../services/InventoryService';
import { User } from 'firebase/auth';

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export function InventoryModal({ isOpen, onClose, user }: InventoryModalProps) {
    const [weightType, setWeightType] = useState('');
    const [scaleModel, setScaleModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [branch, setBranch] = useState('');
    const [status, setStatus] = useState<InventoryStatus>('OPERATIVO'); // New state for status

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Deriving user prefix rules
    const userPrefix = user?.email?.split('@')[0] || '';
    const isCentral = userPrefix.toLowerCase() === 'central';

    useEffect(() => {
        if (isOpen) {
            if (!isCentral) {
                setBranch(userPrefix); // Lock to user prefix
            } else {
                setBranch(''); // Reset for central to select
            }
            setWeightType('');
            setScaleModel('');
            setSerialNumber('');
            setStatus('OPERATIVO'); // Reset status
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, isCentral, userPrefix]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!weightType || !scaleModel || !serialNumber || !branch) {
            setError("Por favor, complete todos los campos.");
            return;
        }
        if (!status) {
            setError("Por favor, seleccione el estatus inicial.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const recordedBy = isCentral ? `usuario central sucursal ${branch}` : userPrefix;

        try {
            await inventoryService.addInventory({
                weightType,
                scaleModel,
                serialNumber,
                branch,
                status, // Pass status to the API call
                recordedBy
            });
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Error al guardar inventario');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-bold text-white">Registro de Inventario</h2>
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
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-3 rounded-lg flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Inventario registrado correctamente
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Tipo de Peso</label>
                        <select
                            value={weightType}
                            onChange={(e) => {
                                setWeightType(e.target.value);
                                setScaleModel(''); // Reset model when type changes
                            }}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                            disabled={isSubmitting || success}
                        >
                            <option value="">-- Seleccionar --</option>
                            <option value="PESO">PESO</option>
                            <option value="BALANZA">BALANZA</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Modelo de Balanza</label>
                        <select
                            value={scaleModel}
                            onChange={(e) => setScaleModel(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                            disabled={isSubmitting || success || !weightType}
                        >
                            <option value="">-- Seleccionar --</option>
                            {weightType === 'PESO' && (
                                <>
                                    <option value="PD 1">PD 1</option>
                                    <option value="PD 2">PD 2</option>
                                    <option value="CHINO">CHINO</option>
                                </>
                            )}
                            {weightType === 'BALANZA' && (
                                <>
                                    <option value="CL 5000H COLGANTE">CL 5000H COLGANTE</option>
                                    <option value="CL 5000H MOSTRADOR">CL 5000H MOSTRADOR</option>
                                    <option value="CL 5200 MOSTRADOR">CL 5200 MOSTRADOR</option>
                                    <option value="CN 1">CN 1</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Serial</label>
                        <input
                            type="text"
                            value={serialNumber}
                            onChange={(e) => setSerialNumber(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                            placeholder="SN-XXXX"
                            disabled={isSubmitting || success}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Estatus Inicial</label>
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
                            <option value="ENVIADO">ENVIADO A OTRA SUCURSAL</option>
                            <option value="TRANSFERIDO">TRANSFERIDO</option>
                        </select>
                        <p className="text-[10px] text-white/30 mt-1 pl-1">Selecciona el estado físico/lógico actual del equipo.</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Sucursal</label>
                        {isCentral ? (
                            <select
                                value={branch}
                                onChange={(e) => setBranch(e.target.value)}
                                className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                                disabled={isSubmitting || success}
                            >
                                <option value="">-- Seleccionar Sucursal --</option>
                                <option value="sandiego">San Diego</option>
                                <option value="bosque">Bosque</option>
                                <option value="trigal">Trigal</option>
                                <option value="naguanagua">Naguanagua</option>
                                <option value="guacara">Guacara</option>
                                <option value="valencia">Valencia</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={branch}
                                readOnly
                                className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-4 py-3 text-white/50 cursor-not-allowed"
                            />
                        )}
                    </div>

                    <div className="mt-4 flex gap-3">
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
                                    GUARDAR
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
