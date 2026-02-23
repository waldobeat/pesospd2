import React, { useEffect, useState } from 'react';
import { historyService, HistoryItem } from '../services/HistoryService';
import { Clock, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface DashboardTickerProps {
    userEmail?: string;
    isAdmin?: boolean;
}

export const DashboardTicker: React.FC<DashboardTickerProps> = ({ userEmail, isAdmin = false }) => {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!userEmail && !isAdmin) return;

            try {
                // Fetch based on permissions
                const data = await historyService.getAll(userEmail, isAdmin);
                setItems(data.slice(0, 10)); // Top 10 most recent
            } catch (e) {
                console.error("Ticker fetch error", e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, [userEmail, isAdmin]); // Re-fetch if user/role changes

    if (loading || items.length === 0) return null;

    return (
        <div className="w-full bg-black/40 border-y border-white/5 backdrop-blur-sm overflow-hidden flex items-center h-8 relative z-40">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#09090b] to-transparent z-10 pointer-events-none" />

            <div className="flex animate-marquee whitespace-nowrap gap-8 items-center px-4">
                {items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex items-center gap-2 text-xs font-mono text-white/60">
                        <span className="text-blue-500/50">
                            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {item.type === 'issue' ? (
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                        ) : item.type === 'repair' ? (
                            <Wrench className="w-3 h-3 text-orange-500" />
                        ) : (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                        <span className={clsx(
                            "font-bold",
                            item.type === 'issue' ? "text-red-400" :
                                item.type === 'repair' ? "text-orange-400" : "text-blue-400"
                        )}>
                            {item.type === 'issue' ? "AVERÍA" : item.type === 'repair' ? "REPARACIÓN" : "CALIBRACIÓN"}
                        </span>
                        <span>{item.model}</span>
                        <span className="text-white/30">#{item.serial}</span>
                        {item.type === 'issue' && (
                            <span className="text-white/40">[{item.status}]</span>
                        )}
                        <span className="text-white/10">|</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
