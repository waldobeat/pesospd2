import React from 'react';
import clsx from 'clsx';
import { Scale, Activity, ArrowRightLeft } from 'lucide-react';

interface ScoreboardProps {
    weight: number;
    unit: string;
    isStable: boolean;
    isZero: boolean;
    isNet: boolean;
    isConnected: boolean;
    error?: string | null;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
    weight,
    unit,
    isStable,
    isZero,
    isNet,
    isConnected,
    error
}) => {
    return (
        <div className="relative w-full max-w-3xl mx-auto p-1px rounded-[2rem] bg-gradient-to-b from-slate-700/50 to-slate-900/50 shadow-2xl overflow-hidden group">
            {/* Animated Border Glow */}
            <div className={clsx(
                "absolute -inset-[2px] opacity-20 blur-xl transition-all duration-1000 group-hover:opacity-40",
                isConnected ? "bg-cyan-500" : "bg-red-500"
            )} />

            <div className="relative p-6 md:p-10 rounded-[1.95rem] bg-slate-950/90 backdrop-blur-3xl border border-white/5 flex flex-col gap-8">

                {/* Header: System Labels */}
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-cyan-500/80">
                            <Scale className="w-4 h-4" />
                            <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-70">Núcleo Industrial</span>
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight text-white/90">SISDEPE <span className="text-white/30 font-light">v2.0</span></h2>
                    </div>

                    <div className={clsx(
                        "flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-500",
                        isConnected
                            ? "bg-cyan-500/5 border-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                            : "bg-red-500/5 border-red-500/20 text-red-400"
                    )}>
                        <Activity className={clsx("w-4 h-4", isConnected && "animate-pulse")} />
                        <span className="text-xs font-black tracking-widest">{isConnected ? "EN LÍNEA" : "DESCONECTADO"}</span>
                    </div>
                </div>

                {/* Main OLED-Style Display */}
                <div className="relative isolate group/display">
                    {/* Inner Glow Background */}
                    <div className={clsx(
                        "absolute -inset-10 blur-[80px] opacity-20 -z-10 transition-colors duration-1000",
                        error ? "bg-red-500" : isStable ? "bg-cyan-500" : "bg-orange-500/50"
                    )} />

                    <div className="relative bg-black/80 rounded-3xl p-8 md:p-12 border border-white/5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center min-h-[220px] overflow-hidden">
                        {/* Scanline Effect */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                            style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 2px)', backgroundSize: '100% 2px' }} />

                        <div className={clsx(
                            "font-mono font-bold text-center tabular-nums tracking-tighter transition-all duration-500 leading-none select-none",
                            error
                                ? "text-red-500 text-5xl md:text-7xl drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                                : isStable
                                    ? "text-cyan-400 text-7xl md:text-9xl lg:text-[10rem] drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]"
                                    : "text-white/90 text-7xl md:text-9xl lg:text-[10rem]"
                        )}>
                            {error ? "ERROR_SISTEMA" : weight.toFixed(2)}
                        </div>

                        {!error && (
                            <div className="absolute bottom-6 right-10 flex flex-col items-end">
                                <span className="text-[10px] font-black text-white/20 tracking-[0.3em] mb-1 uppercase italic">Unidad de Medida</span>
                                <span className="text-2xl md:text-3xl font-black text-cyan-500/40">{unit.toUpperCase()}</span>
                            </div>
                        )}

                        {/* Floating Decoration */}
                        <div className="absolute top-4 left-6 flex gap-1">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="w-1 h-3 bg-white/10 rounded-full" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Industrial Indicator Bars */}
                <div className="grid grid-cols-3 gap-4">
                    <StatusPill label="ESTABLE" active={isStable} activeColor="bg-cyan-400" />
                    <StatusPill label="CERO" active={isZero} activeColor="bg-blue-400" />
                    <StatusPill label="NETO" active={isNet} activeColor="bg-orange-400" />
                </div>

                {/* Reactive Error Bar */}
                {error && (
                    <div className="animate-glow-pulse flex items-center gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-400">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        <ArrowRightLeft className="w-4 h-4 shrink-0" />
                        <span className="font-bold text-[11px] tracking-wider uppercase">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusPill = ({ label, active, activeColor }: { label: string, active: boolean, activeColor: string }) => {
    return (
        <div className={clsx(
            "relative group/pill p-4 rounded-2xl border transition-all duration-500 flex flex-col gap-2 items-center",
            active
                ? "bg-slate-800/50 border-white/10 shadow-lg"
                : "bg-black/20 border-white/5"
        )}>
            <span className={clsx(
                "text-[9px] font-black tracking-[0.2em] transition-colors duration-500",
                active ? "text-white/80" : "text-white/20"
            )}>
                {label}
            </span>
            <div className="relative w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className={clsx(
                    "absolute inset-0 transition-all duration-700 ease-out rounded-full",
                    active ? activeColor : "bg-transparent w-0",
                    active && "shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                )} style={{ width: active ? '100%' : '0%' }} />
            </div>
        </div>
    );
};

