import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { SearchIcon } from '../ui/Icons';
import type { Event as CommunityEvent, Location } from '../../types';

interface SearchResult {
    id: string;
    type: 'event';
    title: string;
    description: string;
    location: Location;
}

const GlobalSearch: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { events } = useData();
    const navigate = useNavigate();

    const searchResults = useMemo(() => {
        if (!query.trim()) {
            return [];
        }

        const lowerCaseQuery = query.toLowerCase();
        const eventResults: SearchResult[] = events
            .filter((event: CommunityEvent) => 
                event.title.toLowerCase().includes(lowerCaseQuery) || 
                event.description.toLowerCase().includes(lowerCaseQuery)
            )
            .map((event: CommunityEvent) => ({
                id: `event-${event.id}`,
                type: 'event',
                title: event.title,
                description: event.description,
                location: event.location,
            }));
        
        return eventResults.slice(0, 10);
    }, [query, events]);

    const handleSelectResult = (result: SearchResult) => {
        setIsOpen(false);
        setQuery('');
        if (result.type === 'event') {
            navigate('/', { state: { flyToLocation: result.location } });
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
    };
    
    const handleClose = () => {
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div>
            <button onClick={handleOpen} aria-label="Open search">
                <SearchIcon className="w-6 h-6 text-text-secondary hover:text-text-primary transition-colors" />
            </button>

            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-[9998]"
                    onClick={handleClose}
                >
                    <div 
                        className="absolute top-0 left-0 right-0 bg-brand-secondary/90 backdrop-blur-md border-b border-brand-accent/20 shadow-lg animate-fade-in-down"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="max-w-md mx-auto p-4">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                                <input
                                    type="text"
                                    placeholder="Search for events..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    autoFocus
                                    className="w-full bg-brand-primary border border-gray-600 rounded-md py-2 pl-10 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
                                />
                            </div>

                            {query.trim() && (
                                <div className="mt-4 max-h-80 overflow-y-auto">
                                    {searchResults.length > 0 ? (
                                        <ul className="space-y-2">
                                            {searchResults.map(result => (
                                                <li key={result.id}>
                                                    <button 
                                                        onClick={() => handleSelectResult(result)}
                                                        className="w-full text-left p-3 bg-brand-primary/50 hover:bg-brand-accent/20 rounded-md transition-colors"
                                                    >
                                                        <p className="font-semibold">{result.title}</p>
                                                        <p className="text-xs text-text-secondary truncate">{result.description}</p>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center p-4 text-text-secondary">
                                            No results found for "{query}".
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
