import React, { useState } from 'react';
import { auth } from '../firebase';
import { historyService, type InventoryRecord } from '../services/HistoryService';
import { PackagePlus, X, Box, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose }) => {
    const [serial, setSerial] = useState('');
    const [model, setModel] = useState('PESO');
    const [branch, setBranch] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!branch) {
            alert("Por favor indique la sucursal.");
            setLoading(false);
            return;
        }

        try {
            await historyService.save({
                model,
                serial,
                branch,
                note,
                user: auth.currentUser?.email || 'Unknown',
            } as InventoryRecord, 'inventory');

            setSuccess(true);
            setTimeout(() => {
                resetForm();
                onClose();
            }, 3000);
        } catch (error) {
            console.error('Error registering inventory:', error);
            alert('Error al registrar el equipo.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSerial('');
        setBranch('');
        setNote('');
        setModel('PESO');
        setSuccess(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-2xl" />

            <div className="relative w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(59,130,246,0.1)] overflow-hidden flex flex-col max-h-[90vh]">
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="p-8 relative border-b border-white/5 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <PackagePlus className="w-5 h-5 text-blue-500" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Registro de Inventario</h2>
                        </div>
                        <p className="text-white/40 text-sm ml-13">Añadir un equipo existente al inventario de la sucursal.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-white/40 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar relative z-10 flex-1">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-6">
                            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-3xl font-black text-white tracking-tight">Registro Exitoso</h3>
                                <p className="text-white/50 text-lg max-w-md mx-auto">
                                    El equipo ha sido incorporado al inventario general logístico.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Tipo de Equipo <span className="text-blue-500">*</span></label>
                                    <select
                                        value={model}
                                        onChange={e => setModel(e.target.value)}
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-blue-500/50 outline-none transition-all text-lg appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="PESO">PESO</option>
                                        <option value="BALANZA">BALANZA</option>
                                        <option value="MONITOR">MONITOR</option>
                                        <option value="FUENTE">FUENTE</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Sucursal Pertinente <span className="text-blue-500">*</span></label>
                                    <select
                                        value={branch}
                                        onChange={e => setBranch(e.target.value)}
                                        className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-blue-500/50 outline-none transition-all text-lg appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="" disabled>Seleccione Sucursal</option>
                                        <option value="GUACARA">GUACARA</option>
                                        <option value="VILLAS">VILLAS</option>
                                        <option value="MORA">MORA</option>
                                        <option value="ACACIAS">ACACIAS</option>
                                        <option value="CASTAÑO">CASTAÑO</option>
                                        <option value="SAN DIEGO">SAN DIEGO</option>
                                        <option value="TUCACAS">TUCACAS</option>
                                        <option value="SAN JUAN">SAN JUAN</option>
                                        <option value="VICTORIA">VICTORIA</option>
                                        <option value="NAGUANAGUA">NAGUANAGUA</option>
                                        <option value="BOSQUE">BOSQUE</option>
                                        <option value="CIRCULO">CIRCULO</option>
                                        <option value="IPSFA">IPSFA</option>
                                        <option value="SANTA RITA">SANTA RITA</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Serial del Equipo (Serie P) <span className="text-blue-500">*</span></label>
                                <input
                                    type="text"
                                    value={serial}
                                    onChange={e => setSerial(e.target.value.toUpperCase())}
                                    placeholder="Ingrese el SN..."
                                    className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-blue-500/50 outline-none transition-all placeholder:text-white/20 text-lg uppercase font-mono"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-white/50 uppercase ml-1">Observaciones (Opcional)</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={2}
                                    className="w-full bg-[#050505] border border-white/10 rounded-2xl px-5 py-3 text-white focus:border-blue-500/50 outline-none resize-none transition-all placeholder:text-white/20 text-sm"
                                    placeholder="Detalles adicionales sobre este equipo..."
                                />
                            </div>

                        </form>
                    )}
                </div>

                {!success && (
                    <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                            disabled={loading}
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={clsx(
                                "px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                                loading
                                    ? "bg-blue-500/50 text-white/50 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                            )}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Box className="w-5 h-5" />
                            )}
                            {loading ? 'REGISTRANDO...' : 'REGISTRAR A INVENTARIO'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
