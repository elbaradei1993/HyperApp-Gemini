import React from 'react';
import { Vibe, SOS, Event, VibeType } from '../../types';
import { timeAgo } from '../../utils/time';
import { FireIcon, BellAlertIcon, GlobeAltIcon } from '../ui/Icons';

export type ActivityItem =
  | (Vibe & { itemType: 'vibe' })
  | (SOS & { itemType: 'sos' })
  | (Event & { itemType: 'event' });

export const VIBE_DISPLAY_NAMES: Record<string, string> = {
    [VibeType.Safe]: 'Safe', [VibeType.Calm]: 'Calm', [VibeType.Noisy]: 'Noisy',
    [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly', [VibeType.Suspicious]: 'Suspicious', [VibeType.Dangerous]: 'Dangerous',
};

export const ActivityCard: React.FC<{ item: ActivityItem }> = ({ item }) => {
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
