import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ShieldCheck, Lock, Loader2, AlertCircle, FileBarChart2, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ReportLoginProps {
    onNavigateBack?: () => void;
}

export const ReportLogin: React.FC<ReportLoginProps> = ({ onNavigateBack }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err: any) {
            console.error('Login error:', err);
            const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
                ? "Credenciales incorrectas. Verifique su correo y contraseña."
                : "Error de autenticación. Verifique su conexión al sistema.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
            {/* Ambient Background Glows */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none" />

            <div className="w-full max-w-lg z-10">
                {/* Back Link */}
                {onNavigateBack && (
                    <button
                        onClick={onNavigateBack}
                        className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-400/80 hover:text-cyan-300 transition-colors py-1.5 px-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 hover:border-cyan-600/60"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver a SISDEPE Principal
                    </button>
                )}

                {/* Card Container */}
                <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl shadow-cyan-950/40 rounded-3xl p-8 md:p-10 relative">
                    <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-inner">
                            <FileBarChart2 className="w-8 h-8" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                            Módulo de Reportes & Inventario
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">
                            Control de Sucursales
                        </h1>
                        <p className="text-slate-400 text-xs mt-1.5 font-medium">
                            Tucacas • San Diego • San Juan | Balanzas y Pesos
                        </p>
                    </div>

                    {/* Store Badges */}
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        {['TUCACAS', 'SAN DIEGO', 'SAN JUAN'].map((store) => (
                            <div
                                key={store}
                                className="bg-slate-800/50 border border-slate-700/50 rounded-xl py-2 px-1 text-center"
                            >
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                                    {store}
                                </span>
                                <span className="text-[9px] text-emerald-400 flex items-center justify-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-2.5 h-2.5 inline" /> Fijo
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Error Box */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
                                Correo de Usuario
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                placeholder="sucursal@ejemplo.com o admin@..."
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black uppercase tracking-wider text-sm shadow-lg shadow-cyan-600/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Autenticando...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" />
                                        <span>Acceder al Reporte</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Note */}
                    <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                        <p className="text-[11px] text-slate-500">
                            Utiliza los mismos usuarios y contraseñas de Firebase registrados en SISDEPE.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
