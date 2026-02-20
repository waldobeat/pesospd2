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
        <div className="relative w-full group">
            {/* Outer Premium Glow */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 rounded-3xl opacity-50 blur-sm pointer-events-none group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative w-full p-8 rounded-3xl bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/5 shadow-2xl overflow-hidden">
                {/* Inner Ambient Glow */}
                <div className="absolute top-0 left-1/4 w-1/2 h-40 bg-blue-500/10 blur-[80px] rounded-full -z-10 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold tracking-widest text-blue-400/80 uppercase mb-1">Dato de Precisión</span>
                        <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-white/80" />
                            <span className="text-sm font-semibold text-white/90 tracking-wide">Módulo de Pesaje</span>
                        </div>
                    </div>
                    <div className={clsx(
                        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                        isConnected
                            ? "bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                    )}>
                        <Activity className="w-3.5 h-3.5" />
                        {isConnected ? "SISTEMA ONLINE" : "OFFLINE"}
                    </div>
                </div>

                {/* Main Display */}
                <div className="relative bg-gradient-to-b from-[#050505] to-[#0a0a0c] rounded-2xl p-8 border border-white/[0.03] shadow-inner mb-8 flex flex-col items-center justify-center min-h-[220px]">
                    <div className={clsx(
                        "font-mono font-bold text-center tabular-nums tracking-tighter transition-all leading-none",
                        error ? "text-red-500 text-6xl" : "text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 text-7xl md:text-9xl [text-shadow:_0_4px_40px_rgba(255,255,255,0.1)]"
                    )}>
                        {error ? "ERROR" : weight.toFixed(2)}
                    </div>
                    {!error && (
                        <div className="absolute bottom-6 right-8 text-2xl font-black text-white/10 tracking-widest">
                            {unit.toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Indicators */}
                <div className="flex justify-between gap-4 px-4">
                    <Indicator label="STABLE" active={isStable} color="green" />
                    <Indicator label="ZERO" active={isZero} color="blue" />
                    <Indicator label="NET" active={isNet} color="yellow" />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-8 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                            <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-sm tracking-wide">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const Indicator = ({ label, active, color }: { label: string, active: boolean, color: 'green' | 'blue' | 'yellow' }) => {
    const colorClasses = {
        green: active ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] scale-110" : "bg-green-900/20 opacity-50",
        blue: active ? "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-110" : "bg-blue-900/20 opacity-50",
        yellow: active ? "bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.6)] scale-110" : "bg-yellow-900/20 opacity-50",
    };

    return (
        <div className="flex flex-col items-center gap-3 p-3 rounded-xl transition-all duration-300 bg-white/[0.02] border border-white/[0.02] flex-1">
            <div className={clsx(
                "w-4 h-4 rounded-full transition-all duration-500",
                colorClasses[color]
            )} />
            <span className={clsx(
                "text-[10px] font-black tracking-widest transition-colors",
                active ? "text-white" : "text-white/30"
            )}>
                {label}
            </span>
        </div>
    );
};
