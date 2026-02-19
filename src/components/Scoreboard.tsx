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
        <div className="relative w-full max-w-2xl mx-auto p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-500/20 blur-3xl rounded-full -z-10" />

            {/* Header */}
            <div className="flex justify-between items-center mb-6 text-white/60">
                <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wider">DIGITAL SCALE INTERFACE</span>
                </div>
                <div className={clsx(
                    "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors",
                    isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                    <Activity className="w-3 h-3" />
                    {isConnected ? "CONNECTED" : "DISCONNECTED"}
                </div>
            </div>

            {/* Main Display */}
            <div className="relative bg-black/50 rounded-2xl p-8 border border-white/5 shadow-inner mb-6">
                <div className={clsx(
                    "text-8xl font-mono font-bold text-center tabular-nums tracking-tight transition-all",
                    error ? "text-red-500" : "text-white"
                )}>
                    {error ? "ERROR" : weight.toFixed(2)}
                </div>
                <div className="absolute bottom-4 right-8 text-2xl font-bold text-white/40">
                    {unit.toUpperCase()}
                </div>
            </div>

            {/* Indicators */}
            <div className="grid grid-cols-3 gap-4">
                <Indicator label="STABLE" active={isStable} color="green" />
                <Indicator label="ZERO" active={isZero} color="blue" />
                <Indicator label="NET" active={isNet} color="yellow" />
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <ArrowRightLeft className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}
        </div>
    );
};

const Indicator = ({ label, active, color }: { label: string, active: boolean, color: 'green' | 'blue' | 'yellow' }) => {
    const colorClasses = {
        green: active ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-green-900/20",
        blue: active ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-blue-900/20",
        yellow: active ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" : "bg-yellow-900/20",
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={clsx(
                "w-3 h-3 rounded-full transition-all duration-300",
                colorClasses[color]
            )} />
            <span className={clsx(
                "text-xs font-bold tracking-widest transition-colors",
                active ? "text-white" : "text-white/20"
            )}>
                {label}
            </span>
        </div>
    );
};
