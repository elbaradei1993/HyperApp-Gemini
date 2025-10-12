import React, { useState, useEffect } from 'react';
import { getNearbyEvents } from '../services/ticketmasterApi';
import { TicketmasterEvent, Location } from '../types';
import { GoogleGenAI } from '@google/genai';
import { LightBulbIcon } from '../components/ui/Icons';

const EventCard: React.FC<{ event: TicketmasterEvent; onGetVibe: (eventId: string) => void; isVibeLoading: boolean; }> = ({ event, onGetVibe, isVibeLoading }) => {
    const venue = event._embedded?.venues?.[0];
    const startDate = event.dates.start.localDate;
    const startTime = event.dates.start.localTime;
    const imageUrl = event.images?.[0]?.url || `https://via.placeholder.com/300x150.png/2d3748/ffffff?text=${encodeURIComponent(event.name)}`;

    const formattedTime = startTime ? new Date(`1970-01-01T${startTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className="bg-brand-secondary rounded-lg overflow-hidden shadow-lg flex flex-col">
            <img src={imageUrl} alt={event.name} className="w-full h-40 object-cover" />
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-white mb-1 truncate" title={event.name}>{event.name}</h3>
                <p className="text-sm text-gray-400 mb-2">{venue?.name}, {venue?.city?.name}</p>
                <p className="text-sm text-gray-400 mb-4">{new Date(startDate).toLocaleDateString()} {formattedTime}</p>
                
                <div className="mt-auto space-y-3">
                    {event.safetyVibe ? (
                        <div className="bg-brand-primary/50 p-3 rounded-md">
                            <p className="text-sm italic text-gray-300 whitespace-pre-wrap">{event.safetyVibe}</p>
                        </div>
                    ) : (
                         <button
                            onClick={() => onGetVibe(event.id)}
                            disabled={isVibeLoading}
                            className="w-full flex items-center justify-center space-x-2 bg-brand-accent/30 text-brand-accent font-semibold py-2 px-4 rounded-md hover:bg-brand-accent/50 disabled:opacity-50 disabled:cursor-wait"
                        >
                            <LightBulbIcon className="w-5 h-5" />
                            <span>{isVibeLoading ? 'Analyzing...' : 'Get Safety Vibe'}</span>
                        </button>
                    )}
                   
                    <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500"
                    >
                        View on Ticketmaster
                    </a>
                </div>
            </div>
        </div>
    );
};


const Events: React.FC = () => {
    const [events, setEvents] = useState<TicketmasterEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vibeLoadingEventId, setVibeLoadingEventId] = useState<string | null>(null);
    const [location, setLocation] = useState<Location | null>(null);

    // 1. Get User Location
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (err) => {
                console.error("Error getting location:", err);
                setError("Could not get your location. Please enable location services to find nearby events.");
                setLoading(false);
            }
        );
    }, []);

    // 2. Fetch Events when location is available
    useEffect(() => {
        if (location) {
            setLoading(true);
            setError(null);
            getNearbyEvents(location)
                .then(setEvents)
                .catch((err) => {
                    console.error(err);
                    setError("Could not fetch events from Ticketmaster.");
                })
                .finally(() => setLoading(false));
        }
    }, [location]);
    
    // 3. AI "Safety Vibe" Generator
    const handleGetSafetyVibe = async (eventId: string) => {
        const eventToAnalyze = events.find(e => e.id === eventId);
        if (!eventToAnalyze) return;
        
        setVibeLoadingEventId(eventId);
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API key not configured.");
            
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Based on the following event details, provide a very brief (2-3 sentences) "Safety Vibe" summary for a potential attendee. Focus on the likely atmosphere and what to expect. For example, is it likely to be a relaxed, family-friendly event, or a high-energy event with large, dense crowds? End with one practical tip.
---
Event Name: ${eventToAnalyze.name}
Venue Type: ${eventToAnalyze._embedded?.venues?.[0]?.name || 'N/A'}
---`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const safetyVibe = response.text;

            // Update the state for this specific event
            setEvents(currentEvents => currentEvents.map(e => 
                e.id === eventId ? { ...e, safetyVibe } : e
            ));

        } catch (err: any) {
            console.error("Failed to generate safety vibe:", err);
            // Optionally, show an error message to the user
        } finally {
            setVibeLoadingEventId(null);
        }
    };


    const renderContent = () => {
        if (loading) return <p className="text-center py-8 text-gray-400">Finding events near you...</p>;
        if (error) return <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>;
        if (events.length === 0) return <p className="text-center py-8 text-gray-400">No upcoming events found in your area.</p>;
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map(event => (
                    <EventCard 
                        key={event.id} 
                        event={event} 
                        onGetVibe={handleGetSafetyVibe}
                        isVibeLoading={vibeLoadingEventId === event.id}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Nearby Events</h1>
            {renderContent()}
        </div>
    );
};

export default Events;
