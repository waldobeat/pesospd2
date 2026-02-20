import React from 'react';
import { X, Terminal, MonitorCheck } from 'lucide-react';
import { serialService } from '../services/SerialService';


interface TestWeightWindowProps {
    isOpen: boolean;
    onClose: () => void;
    rawBuffer: string[];
    error?: string | null;
    weight: number;
}

export const TestWeightWindow: React.FC<TestWeightWindowProps> = ({
    isOpen,
    onClose,
    rawBuffer,
    error,
    weight
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <MonitorCheck className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl font-bold text-white">Probar Peso (Test Weight)</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <span className="text-sm text-white/40 block mb-1">Último Peso Recibido</span>
                            <span className="text-3xl font-mono font-bold text-white">{weight.toFixed(2)}</span>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <span className="text-sm text-white/40 block mb-1">Estado de Comunicación</span>
                            {error ? (
                                <span className="text-red-400 font-bold flex items-center gap-2">
                                    ⚠️ FALLO: {error}
                                </span>
                            ) : (
                                <span className="text-green-400 font-bold flex items-center gap-2">
                                    ✅ NOMINAL
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Raw Data Terminal */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-white/60 flex items-center gap-2">
                                <Terminal className="w-4 h-4" />
                                Raw Data Stream (Last 20 frames)
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => serialService.send('W')} className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-2 py-1 rounded transition-colors">
                                    Send 'W' (Init)
                                </button>
                                <button onClick={() => serialService.send('\r')} className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2 py-1 rounded transition-colors">
                                    Send 'CR' (Stop)
                                </button>
                            </div>
                        </div>

                        <div className="bg-black/80 rounded-xl p-4 font-mono text-xs md:text-sm text-green-500/80 h-64 overflow-y-auto border border-white/10 shadow-inner">
                            {rawBuffer.length === 0 ? (
                                <span className="text-white/20 italic">No data received yet...</span>
                            ) : (
                                rawBuffer.map((line, i) => (
                                    <div key={i} className="border-b border-white/5 last:border-0 py-1 flex font-mono">
                                        <span className="w-8 text-white/20 select-none">{i + 1}</span>
                                        <span className="break-all whitespace-pre-wrap">{
                                            line.replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => {
                                                if (c === '\r') return '\\r';
                                                if (c === '\n') return '\\n';
                                                return '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase();
                                            })
                                        }</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="text-white/40 text-sm bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                        <p><strong>Nota Técnica:</strong></p>
                        <p>El formato esperado de error de hardware es <code>\x02?\x15\x0D</code> (o similar). La ventana muestra los caracteres de control escapados (ej. <code>\x02</code> para STX).</p>
                    </div>

                </div>
            </div>
        </div>
    );
};
