import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { VibeType, TrendingVibe } from '../types';
import { ClockIcon, FireIcon } from '../components/ui/Icons';

type TimeFilter = 'day' | 'week' | 'all';

const VIBE_CONFIG: Record<string, { emoji: string; textClass: string; displayName: string; barClass: string }> = {
    [VibeType.Safe]: { emoji: '😊', textClass: 'text-green-300', displayName: 'Safe', barClass: 'bg-green-500' },
    [VibeType.Calm]: { emoji: '😌', textClass: 'text-blue-300', displayName: 'Calm', barClass: 'bg-blue-500' },
    [VibeType.Noisy]: { emoji: '🔊', textClass: 'text-yellow-300', displayName: 'Noisy', barClass: 'bg-yellow-500' },
    [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', textClass: 'text-purple-300', displayName: 'LGBTQIA+ Friendly', barClass: 'bg-purple-500' },
    [VibeType.Suspicious]: { emoji: '🤨', textClass: 'text-orange-300', displayName: 'Suspicious', barClass: 'bg-orange-500' },
    [VibeType.Dangerous]: { emoji: '😠', textClass: 'text-red-300', displayName: 'Dangerous', barClass: 'bg-red-500' },
};

const Trending: React.FC = () => {
    const { vibes, loading, error } = useData();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');

    const trends = useMemo((): TrendingVibe[] => {
        const now = new Date();
        const oneDayAgo = new Date(now.valueOf() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.valueOf() - 7 * 24 * 60 * 60 * 1000);

        const filteredVibes = vibes.filter(vibe => {
            if (timeFilter === 'all') return true;
            const vibeDate = new Date(vibe.created_at);
            if (timeFilter === 'day') return vibeDate > oneDayAgo;
            if (timeFilter === 'week') return vibeDate > oneWeekAgo;
            return false;
        });

        if (filteredVibes.length === 0) return [];

        const trendMap = new Map<VibeType, { count: number; latest: string }>();

        for (const vibe of filteredVibes) {
            const { vibe_type, created_at } = vibe;
            if (trendMap.has(vibe_type as VibeType)) {
                const existing = trendMap.get(vibe_type as VibeType)!;
                existing.count++;
                if (new Date(created_at) > new Date(existing.latest)) {
                    existing.latest = created_at;
                }
            } else {
                trendMap.set(vibe_type as VibeType, { count: 1, latest: created_at });
            }
        }
        
        return Array.from(trendMap.entries())
            .map(([vibe_type, { count, latest }]) => ({
                vibe_type,
                vibe_count: count,
                latest_report: latest,
            }))
            .sort((a, b) => b.vibe_count - a.vibe_count);

    }, [vibes, timeFilter]);
    
    const maxCount = trends.length > 0 ? Math.max(...trends.map(t => t.vibe_count)) : 0;

    const FilterButton: React.FC<{ filter: TimeFilter; label: string }> = ({ filter, label }) => (
        <button
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                timeFilter === filter ? 'bg-brand-accent text-white' : 'bg-brand-secondary text-gray-400 hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Trending Vibes</h1>
            
            <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FireIcon className="w-5 h-5 text-brand-accent"/>
                        Community Activity
                    </h2>
                    <div className="flex space-x-2">
                        <FilterButton filter="day" label="24h" />
                        <FilterButton filter="week" label="7d" />
                        <FilterButton filter="all" label="All" />
                    </div>
                </div>

                {loading ? <p className="text-center py-8 text-gray-400">Loading trends...</p>
                : error ? <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>
                : trends.length === 0 ? <p className="text-center py-8 text-gray-400">No trending vibes to show for this period.</p>
                : (
                    <div className="space-y-4 pt-2">
                        {trends.map((trend) => {
                            const config = VIBE_CONFIG[trend.vibe_type];
                            if (!config) return null;
                            const barWidth = maxCount > 0 ? (trend.vibe_count / maxCount) * 100 : 0;
                            const latestReportDate = new Date(trend.latest_report);
                            const timeSince = (new Date().getTime() - latestReportDate.getTime()) / 1000; // in seconds
                            const isRecent = timeSince < 60 * 60 * 24; // Less than 24 hours

                            return (
                                <div key={trend.vibe_type}>
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xl">{config.emoji}</span>
                                            <span className={`font-bold ${config.textClass}`}>{config.displayName}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-white">{trend.vibe_count} report{trend.vibe_count !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="w-full bg-brand-primary rounded-full h-2.5">
                                        <div 
                                          className={`${config.barClass} h-2.5 rounded-full`} 
                                          style={{ width: `${barWidth}%`, transition: 'width 0.5s ease-in-out' }}
                                        ></div>
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 mt-1.5">
                                        <ClockIcon className="w-3 h-3 mr-1"/>
                                        <span>Last report: {latestReportDate.toLocaleDateString()}</span>
                                        {isRecent && <span className="ml-2 text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full text-xs">Recent</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Trending;