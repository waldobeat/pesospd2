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
        <div className="relative w-full max-w-2xl mx-auto p-6 md:p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-blue-900/10 hover:border-white/20">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-500/10 blur-3xl rounded-full -z-10 animate-pulse" />

            {/* Header */}
            <div className="flex justify-between items-center mb-6 text-white/60">
                <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    <span className="text-xs md:text-sm font-bold tracking-wider">SISDEPES INTERFACE</span>
                </div>
                <div className={clsx(
                    "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all border border-transparent",
                    isConnected
                        ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                )}>
                    <Activity className="w-3 h-3" />
                    {isConnected ? "ONLINE" : "OFFLINE"}
                </div>
            </div>

            {/* Main Display */}
            <div className="relative bg-black/50 rounded-2xl p-6 md:p-10 border border-white/5 shadow-inner mb-6 flex flex-col items-center justify-center min-h-[160px] md:min-h-[200px]">
                <div className={clsx(
                    "font-mono font-bold text-center tabular-nums tracking-tighter transition-all leading-none",
                    error ? "text-red-500 text-5xl md:text-6xl" : "text-white text-6xl md:text-8xl lg:text-9xl"
                )}>
                    {error ? "ERROR" : weight.toFixed(2)}
                </div>
                {!error && (
                    <div className="absolute bottom-4 right-6 text-xl md:text-2xl font-bold text-white/20">
                        {unit.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Indicators */}
            <div className="flex justify-between md:justify-around gap-2 px-2">
                <Indicator label="STABLE" active={isStable} color="green" />
                <Indicator label="ZERO" active={isZero} color="blue" />
                <Indicator label="NET" active={isNet} color="yellow" />
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <ArrowRightLeft className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-sm">{error}</span>
                </div>
            )}
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
        <div className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all duration-300">
            <div className={clsx(
                "w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300",
                colorClasses[color]
            )} />
            <span className={clsx(
                "text-[10px] md:text-xs font-bold tracking-widest transition-colors",
                active ? "text-white" : "text-white/20"
            )}>
                {label}
            </span>
        </div>
    );
};
