import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ReportLogin } from './ReportLogin';
import { BranchReportsView } from './BranchReportsView';
import { Loader2 } from 'lucide-react';

interface ReportsPageProps {
    onNavigateHome: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateHome }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300 gap-3">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs uppercase font-bold tracking-widest text-slate-400">
                    Cargando módulo de reportes...
                </span>
            </div>
        );
    }

    if (!user) {
        return <ReportLogin onNavigateBack={onNavigateHome} />;
    }

    return <BranchReportsView user={user} onNavigateBack={onNavigateHome} />;
};
