import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Vibe, SOS, Event, VibeType } from '../types';
import { timeAgo } from '../utils/time';
import { FireIcon, BellAlertIcon, GlobeAltIcon } from '../components/ui/Icons';

// FIX: Redefined ActivityItem as a proper discriminated union.
// This allows TypeScript to correctly infer the type of `item` inside the switch statement.
type ActivityItem =
  | (Vibe & { itemType: 'vibe' })
  | (SOS & { itemType: 'sos' })
  | (Event & { itemType: 'event' });

const VIBE_DISPLAY_NAMES: Record<string, string> = {
    [VibeType.Safe]: 'Safe', [VibeType.Calm]: 'Calm', [VibeType.Noisy]: 'Noisy',
    [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly', [VibeType.Suspicious]: 'Suspicious', [VibeType.Dangerous]: 'Dangerous',
};

const ActivityCard: React.FC<{ item: ActivityItem }> = ({ item }) => {
    let icon, title, details;

    switch (item.itemType) {
        case 'vibe':
            icon = <FireIcon className="w-6 h-6 text-orange-400" />;
            title = `New Vibe: ${VIBE_DISPLAY_NAMES[item.vibe_type] || 'Unknown'}`;
            details = `Reported by ${item.profiles?.username || 'anonymous'}`;
            break;
        case 'sos':
            icon = <BellAlertIcon className="w-6 h-6 text-red-400" />;
            title = `SOS Alert`;
            details = `${item.details ? `"${item.details}" - ` : ''}from ${item.profiles?.username || 'anonymous'}`;
            break;
        case 'event':
            icon = <GlobeAltIcon className="w-6 h-6 text-blue-400" />;
            title = `New Event: ${item.title}`;
            details = `Created by ${item.profiles?.username || 'anonymous'}`;
            break;
    }

    return (
        <div className="bg-brand-secondary p-4 rounded-lg flex items-start space-x-4">
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow">
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-gray-400">{details}</p>
            </div>
            <div className="flex-shrink-0 text-xs text-gray-500">{timeAgo(item.created_at)}</div>
        </div>
    );
};

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
            <h1 className="text-3xl font-bold">Activity Feed</h1>

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