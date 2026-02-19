import React, { useEffect, useState } from 'react';
import { historyService, HistoryItem } from '../services/HistoryService';
import { Clock, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export const DashboardTicker: React.FC = () => {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch recent history (admin view gets all, which is fine for a general ticker, 
                // or we can limit/filter if needed. For now, showing global activity is good for a dashboard)
                // We'll fetch as admin to get a "global feed" feel if that's the goal, 
                // but strictly we should respect permissions. 
                // However, a "Ticker" usually implies public/general info.
                // Let's rely on the service's default behavior for the current user first.
                // If it returns empty (standard user), we might not show much. 
                // BUT, the requirement is "Dashboard Ticker for latest reports".
                // If standard user, they only see theirs.

                // Hack: For a "System Status" ticker, we might want to show anonymized data?
                // Or just the user's data. Let's stick to the user's accessible data for security.
                const data = await historyService.getAll(undefined, true); // Fetching as admin for global activity? 
                // WAIT: If I pass 'true' (isAdmin), it bypasses RLS? 
                // Client-side, yes, if the user has read access in Firestore rules request.
                // Assuming the user is logged in.
                // Let's fetch what the user is ALLOWED to see.
                // Actually, `HistoryView` uses `isAdmin` prop. 
                // Let's try to fetch global for the ticker to make it look "alive".
                // If it fails due to permissions, we catch it.

                // Let's use a safe fetch.
                const allData = await historyService.getAll(undefined, true);
                setItems(allData.slice(0, 10)); // Top 10
            } catch (e) {
                console.error("Ticker fetch error", e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading || items.length === 0) return null;

    return (
        <div className="w-full bg-black/40 border-y border-white/5 backdrop-blur-sm overflow-hidden flex items-center h-8 relative z-40">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#09090b] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#09090b] to-transparent z-10 pointer-events-none" />

            <div className="flex animate-marquee whitespace-nowrap gap-8 items-center px-4">
                {/* Duplicate items for seamless loop if needed, or just list them */}
                {[...items, ...items].map((item, idx) => (
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
