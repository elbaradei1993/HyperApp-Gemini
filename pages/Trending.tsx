import React, { useState, useEffect } from 'react';
import { getNearbyEvents } from '../services/ticketmasterApi';
import { useData } from '../contexts/DataContext';
import { VibeType, TicketmasterEvent } from '../types';
import { FireIcon, UserGroupIcon } from '../components/ui/Icons';

interface VibeTrend {
    type: VibeType;
    count: number;
    percentage: number;
}

const VIBE_CONFIG: Record<string, { displayName: string; textClass: string; barClass: string }> = {
  [VibeType.Safe]: { displayName: 'Safe', textClass: 'text-green-300', barClass: 'bg-green-500' },
  [VibeType.Calm]: { displayName: 'Calm', textClass: 'text-blue-300', barClass: 'bg-blue-500' },
  [VibeType.Noisy]: { displayName: 'Noisy', textClass: 'text-yellow-300', barClass: 'bg-yellow-500' },
  [VibeType.LGBTQIAFriendly]: { displayName: 'LGBTQIA+ Friendly', textClass: 'text-purple-300', barClass: 'bg-purple-500' },
  [VibeType.Suspicious]: { displayName: 'Suspicious', textClass: 'text-orange-300', barClass: 'bg-orange-500' },
  [VibeType.Dangerous]: { displayName: 'Dangerous', textClass: 'text-red-300', barClass: 'bg-red-500' },
};

const Trending: React.FC = () => {
    const { vibes, loading: dataLoading, error: dataError } = useData();
    const [trendingVibes, setTrendingVibes] = useState<VibeTrend[]>([]);
    const [nearbyEvents, setNearbyEvents] = useState<TicketmasterEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    useEffect(() => {
        if (!dataLoading && vibes.length > 0) {
            const vibeCounts = vibes.reduce<Record<string, number>>((acc, vibe) => {
                acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
                return acc;
            }, {});
            const totalVibes = vibes.length;
            const trends = Object.entries(vibeCounts)
                .map(([type, count]) => ({
                    type: type as VibeType,
// FIX: Explicitly cast `count` to a number to satisfy TypeScript's type checker for arithmetic operations and state updates.
                    count: count as number,
                    percentage: ((count as number) / totalVibes) * 100,
                }))
                .sort((a, b) => b.count - a.count);
            setTrendingVibes(trends);
        }
    }, [vibes, dataLoading]);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            setEventsLoading(true);
            const events = await getNearbyEvents({ lat: latitude, lng: longitude });
            setNearbyEvents(events);
            setEventsLoading(false);
        }, () => {
            console.error("Could not get location for Ticketmaster events.");
            setEventsLoading(false);
        });
    }, []);
    
    const SkeletonLoader = () => (
        <div className="bg-brand-secondary p-4 rounded-lg space-y-3 animate-pulse">
            <div className="h-5 bg-gray-600 rounded w-3/4"></div>
            <div className="h-3 bg-gray-600 rounded w-1/2"></div>
            <div className="h-3 bg-gray-600 rounded w-1/4"></div>
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Trending</h1>

            <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
                <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <FireIcon className="w-6 h-6 text-orange-400" />
                    <span>Trending Community Vibes</span>
                </h2>
                {dataLoading ? (
                    <p className="text-gray-400">Loading vibe data...</p>
                ) : dataError ? (
                    <p className="text-red-400">{dataError}</p>
                ) : trendingVibes.length > 0 ? (
                    <div className="space-y-2 pt-2">
                        {trendingVibes.map(trend => (
                            <div key={trend.type}>
                                <div className="flex justify-between items-center text-sm font-medium mb-1">
                                    <span className={VIBE_CONFIG[trend.type].textClass}>{VIBE_CONFIG[trend.type].displayName}</span>
                                    <span className="text-gray-400">{trend.percentage.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className={`${VIBE_CONFIG[trend.type].barClass} h-2.5 rounded-full`} style={{ width: `${trend.percentage}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400">Not enough data to show trends.</p>
                )}
            </div>

            <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
                 <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <UserGroupIcon className="w-6 h-6 text-blue-400" />
                    <span>Nearby Major Events</span>
                </h2>
                {eventsLoading ? (
                   <div className="space-y-4">
                       <SkeletonLoader />
                       <SkeletonLoader />
                   </div>
                ) : nearbyEvents.length > 0 ? (
                    <div className="space-y-4">
                        {nearbyEvents.slice(0, 5).map(event => (
                            <a href={event.url} target="_blank" rel="noopener noreferrer" key={event.id} className="block bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition-colors">
                                <p className="font-bold text-white truncate">{event.name}</p>
                                <p className="text-sm text-gray-400">{event._embedded?.venues[0]?.name || 'Venue not specified'}</p>
                                <p className="text-xs text-brand-accent mt-1">{new Date(event.dates.start.localDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400">No major events found nearby via Ticketmaster.</p>
                )}
            </div>
        </div>
    );
};

export default Trending;