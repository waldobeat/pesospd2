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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
            <div className="w-full max-w-[95vw] sm:max-w-3xl bg-[#0f172a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-white/5 bg-white/5 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <MonitorCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
                        <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Probar Peso (Test Weight)</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 custom-scrollbar">

                    {/* Status Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-2 sm:gap-0">
                            <span className="text-xs sm:text-sm font-bold text-white/60 flex items-center gap-2">
                                <Terminal className="w-4 h-4 shrink-0" />
                                Raw Data (Last 20)
                            </span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => serialService.send('W')} className="flex-1 sm:flex-none text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-2 sm:py-1 rounded transition-colors text-center font-bold">
                                    Send 'W' (Init)
                                </button>
                                <button onClick={() => serialService.send('\r')} className="flex-1 sm:flex-none text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 sm:py-1 rounded transition-colors text-center font-bold">
                                    Send 'CR' (Stop)
                                </button>
                            </div>
                        </div>

                        <div className="bg-black/80 rounded-xl p-3 sm:p-4 font-mono text-[10px] sm:text-xs md:text-sm text-green-500/80 h-48 sm:h-64 overflow-y-auto border border-white/10 shadow-inner custom-scrollbar">
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

                    <div className="text-white/40 text-xs sm:text-sm bg-blue-500/10 p-3 sm:p-4 rounded-xl border border-blue-500/20">
                        <p><strong>Nota Técnica:</strong></p>
                        <p className="mt-1">El formato esperado de error de hardware es <code className="bg-black/30 px-1 rounded text-white/60">{'\\x02?\\x15\\x0D'}</code>. La ventana escapa caracteres ocultos.</p>
                    </div>

                </div>
            </div>
        </div>
    );
};
