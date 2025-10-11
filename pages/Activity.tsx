
import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Vibe, SOS, Event, VibeType } from '../types';
import { timeAgo } from '../utils/time';
import { BellAlertIcon, FireIcon, GlobeAltIcon } from '../components/ui/Icons';

const VIBE_CONFIG: Record<string, { emoji: string; textClass: string; displayName: string; }> = {
    [VibeType.Safe]: { emoji: '😊', textClass: 'text-green-300', displayName: 'Safe' },
    [VibeType.Calm]: { emoji: '😌', textClass: 'text-blue-300', displayName: 'Calm' },
    [VibeType.Noisy]: { emoji: '🔊', textClass: 'text-yellow-300', displayName: 'Noisy' },
    [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', textClass: 'text-purple-300', displayName: 'LGBTQIA+ Friendly' },
    [VibeType.Suspicious]: { emoji: '🤨', textClass: 'text-orange-300', displayName: 'Suspicious' },
    [VibeType.Dangerous]: { emoji: '😠', textClass: 'text-red-300', displayName: 'Dangerous' },
};

type ActivityItem = (Vibe | SOS | Event) & { itemType: 'vibe' | 'sos' | 'event' };

const ActivityCard: React.FC<{ item: ActivityItem }> = ({ item }) => {
    const renderContent = () => {
        switch (item.itemType) {
            case 'vibe':
                const vibe = item as Vibe;
                const config = VIBE_CONFIG[vibe.vibe_type];
                if (!config) return null;
                return (
                    <>
                        <FireIcon className="w-6 h-6 text-orange-400" />
                        <div className="flex-1">
                            <p className="font-semibold text-white">
                                <span className="mr-2">{config.emoji}</span>
                                A <span className={config.textClass}>{config.displayName}</span> vibe was reported
                            </p>
                            <p className="text-sm text-gray-400">
                                by {vibe.profiles?.username || 'anonymous'} • {timeAgo(vibe.created_at)}
                            </p>
                        </div>
                    </>
                );
            case 'sos':
                const sos = item as SOS;
                return (
                    <>
                        <BellAlertIcon className="w-6 h-6 text-red-400 animate-pulse" />
                        <div className="flex-1">
                            <p className="font-semibold text-red-300">SOS Alert Activated</p>
                            <p className="text-sm text-gray-400">
                                by {sos.profiles?.username || 'anonymous'} • {timeAgo(sos.created_at)}
                            </p>
                        </div>
                    </>
                );
            case 'event':
                const event = item as Event;
                return (
                    <>
                        <GlobeAltIcon className="w-6 h-6 text-blue-400" />
                        <div className="flex-1">
                            <p className="font-semibold text-white">New Event: {event.title}</p>
                            <p className="text-sm text-gray-400">
                                by {event.profiles?.username || 'anonymous'} • {timeAgo(event.created_at)}
                            </p>
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-brand-secondary p-4 rounded-lg flex items-center space-x-4">
            {renderContent()}
        </div>
    );
};

const Activity: React.FC = () => {
    const { vibes, sos, events, loading, error } = useData();

    const activityFeed = useMemo((): ActivityItem[] => {
        const mappedVibes: ActivityItem[] = vibes.map(v => ({ ...v, itemType: 'vibe' }));
        const mappedSOS: ActivityItem[] = sos.map(s => ({ ...s, itemType: 'sos' }));
        const mappedEvents: ActivityItem[] = events.map(e => ({ ...e, itemType: 'event' }));

        return [...mappedVibes, ...mappedSOS, ...mappedEvents]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [vibes, sos, events]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Global Activity Feed</h1>
            
            {loading ? <p className="text-center py-8 text-gray-400">Loading activity...</p>
            : error ? <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>
            : activityFeed.length === 0 ? <p className="text-center py-8 text-gray-400">No community activity to show yet.</p>
            : (
                <div className="space-y-3">
                    {activityFeed.map(item => <ActivityCard key={`${item.itemType}-${item.id}`} item={item} />)}
                </div>
            )}
        </div>
    );
};

export default Activity;