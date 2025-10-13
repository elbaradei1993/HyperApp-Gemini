import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { ActivityCard, ActivityItem } from '../components/activity/ActivityCard';

const Activity: React.FC = () => {
    const { vibes, sos, events, loading, error } = useData();

    const sortedActivityFeed = useMemo(() => {
        const combined: ActivityItem[] = [
            ...vibes.map(v => ({ ...v, itemType: 'vibe' as const })),
            ...sos.map(s => ({ ...s, itemType: 'sos' as const })),
            ...events.map(e => ({ ...e, itemType: 'event' as const })),
        ];

        return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [vibes, sos, events]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Trending Activity</h1>

            {loading ? <p className="text-center py-8 text-gray-400">Loading activity...</p>
            : error ? <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>
            : sortedActivityFeed.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No recent activity in the community.</p>
            )
            : (
                <div className="space-y-4">
                    {sortedActivityFeed.map(item => (
                        <ActivityCard key={`${item.itemType}-${item.id}`} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Activity;