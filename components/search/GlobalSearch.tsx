
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { Vibe, SOS, Event, VibeType, Location } from '../../types';
import { SearchIcon, BellAlertIcon, FireIcon, GlobeAltIcon } from '../ui/Icons';
import { timeAgo } from '../../utils/time';

const VIBE_DISPLAY_NAMES: Record<string, string> = {
    [VibeType.Safe]: 'Safe', [VibeType.Calm]: 'Calm', [VibeType.Noisy]: 'Noisy',
    [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly', [VibeType.Suspicious]: 'Suspicious', [VibeType.Dangerous]: 'Dangerous',
};

type SearchResult = {
    id: string;
    type: 'vibe' | 'sos' | 'event';
    title: string;
    subtitle: string;
    location: Location;
};

const GlobalSearch: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { vibes, sos, events } = useData();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when search opens
    useEffect(() => {
        if (isOpen) {
            // A small timeout allows the element to be rendered before focusing
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const searchResults = useMemo((): SearchResult[] => {
        if (!query.trim()) return [];
        const lowerCaseQuery = query.toLowerCase();

        const vibeResults: SearchResult[] = vibes
            .filter(v =>
                VIBE_DISPLAY_NAMES[v.vibe_type]?.toLowerCase().includes(lowerCaseQuery) ||
                v.profiles?.username?.toLowerCase().includes(lowerCaseQuery)
            )
            .map(v => ({
                id: `vibe-${v.id}`,
                type: 'vibe',
                title: `${VIBE_DISPLAY_NAMES[v.vibe_type] || 'Unknown'} Vibe`,
                subtitle: `by ${v.profiles?.username || 'anonymous'} • ${timeAgo(v.created_at)}`,
                location: v.location,
            }));

        const sosResults: SearchResult[] = sos
            .filter(s =>
                s.details?.toLowerCase().includes(lowerCaseQuery) ||
                s.profiles?.username?.toLowerCase().includes(lowerCaseQuery)
            )
            .map(s => ({
                id: `sos-${s.id}`,
                type: 'sos',
                title: `SOS Alert`,
                subtitle: `by ${s.profiles?.username || 'anonymous'} • ${timeAgo(s.created_at)}`,
                location: s.location,
            }));

        const eventResults: SearchResult[] = events
            .filter(e =>
                e.title.toLowerCase().includes(lowerCaseQuery) ||
                e.description?.toLowerCase().includes(lowerCaseQuery) ||
                e.profiles?.username?.toLowerCase().includes(lowerCaseQuery)
            )
            .map(e => ({
                id: `event-${e.id}`,
                type: 'event',
                title: e.title,
                subtitle: `Event by ${e.profiles?.username || 'anonymous'}`,
                location: e.location,
            }));

        return [...vibeResults, ...sosResults, ...eventResults];

    }, [query, vibes, sos, events]);

    const handleResultClick = (result: SearchResult) => {
        setIsOpen(false);
        setQuery('');
        navigate('/', { state: { flyToLocation: result.location } });
    };
    
    const ResultIcon = ({ type }: { type: SearchResult['type'] }) => {
        switch(type) {
            case 'vibe': return <FireIcon className="w-5 h-5 text-orange-400" />;
            case 'sos': return <BellAlertIcon className="w-5 h-5 text-red-400" />;
            case 'event': return <GlobeAltIcon className="w-5 h-5 text-blue-400" />;
            default: return null;
        }
    }

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="text-gray-300 hover:text-white p-2">
                <SearchIcon className="w-6 h-6" />
            </button>

            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/70 z-[100]"
                    onClick={() => setIsOpen(false)}
                >
                    <div 
                        className="fixed top-0 left-0 right-0 bg-brand-secondary shadow-lg animate-fade-in-down"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="max-w-md mx-auto p-4">
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search vibes, alerts, or events..."
                                    className="w-full bg-brand-primary text-white border border-gray-600 rounded-md py-2 px-3 pl-10 focus:outline-none focus:ring-2 focus:ring-brand-accent"
                                />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            
                            <div className="mt-4 max-h-[60vh] overflow-y-auto">
                                {query.trim() && searchResults.length === 0 && (
                                    <p className="text-center text-gray-400 py-4">No results found.</p>
                                )}
                                <ul className="space-y-2">
                                    {searchResults.map(result => (
                                        <li key={result.id}>
                                            <button 
                                                onClick={() => handleResultClick(result)}
                                                className="w-full text-left flex items-center space-x-3 p-3 rounded-md bg-brand-primary hover:bg-gray-800 transition-colors"
                                            >
                                                <ResultIcon type={result.type} />
                                                <div>
                                                    <p className="font-semibold text-white">{result.title}</p>
                                                    <p className="text-sm text-gray-400">{result.subtitle}</p>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalSearch;
