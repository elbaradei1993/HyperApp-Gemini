import React, { useMemo, useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import type { Event, AiEvent } from '../types';
import { PlusCircleIcon, PencilSquareIcon, UserGroupIcon, SparklesIcon } from '../components/ui/Icons';

interface EventCardProps {
    event: Event;
    currentUserId: string;
    isAttending: boolean;
    onAttend: (eventId: number) => Promise<void>;
    onLeave: (eventId: number) => Promise<void>;
}

const EventCard: React.FC<EventCardProps> = ({ event, currentUserId, isAttending, onAttend, onLeave }) => {
    // Local state for truly optimistic updates inside the card
    const [localIsAttending, setLocalIsAttending] = useState(isAttending);
    const [localAttendeeCount, setLocalAttendeeCount] = useState(event.attendee_count || 0);
    const [actionLoading, setActionLoading] = useState(false);

    // Sync local state with props when they change from the parent (e.g., from a real-time update)
    useEffect(() => {
        setLocalIsAttending(isAttending);
        setLocalAttendeeCount(event.attendee_count || 0);
    }, [isAttending, event.attendee_count]);

    const handleAttend = async () => {
        setActionLoading(true);
        // Optimistic UI update
        setLocalIsAttending(true);
        setLocalAttendeeCount(prev => prev + 1);
        await onAttend(event.id); // Propagate change to global state
        setActionLoading(false);
    };

    const handleLeave = async () => {
        setActionLoading(true);
        // Optimistic UI update
        setLocalIsAttending(false);
        setLocalAttendeeCount(prev => Math.max(0, prev - 1));
        await onLeave(event.id); // Propagate change to global state
        setActionLoading(false);
    };
    
    const isOwner = event.user_id === currentUserId;
    const now = new Date();
    const eventEndDate = event.end_time ? new Date(event.end_time) : new Date(new Date(event.event_time).getTime() + 2 * 60 * 60 * 1000); // Default 2h duration
    const isPastEvent = eventEndDate < now;

    return (
        <div className={`bg-brand-secondary p-4 rounded-lg space-y-3 ${isPastEvent ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <p className="text-sm text-gray-400">by {event.profiles?.username || 'anonymous'}</p>
                </div>
                {isOwner && (
                    <div className="flex space-x-2">
                        <Link to={`/edit-event/${event.id}`} className="p-2 text-gray-400 hover:text-white">
                            <PencilSquareIcon className="w-5 h-5" />
                        </Link>
                    </div>
                )}
            </div>
            <p className="text-gray-300">{event.description}</p>
            <div>
                <p className="font-semibold text-brand-accent">
                    {new Date(event.event_time).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-gray-400">
                    {new Date(event.event_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {event.end_time && ` - ${new Date(event.end_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
                </p>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <div className="flex items-center space-x-2">
                    <UserGroupIcon className="w-5 h-5 text-brand-accent"/>
                    <span className="font-bold text-white">{localAttendeeCount}</span>
                    <span className="text-sm text-gray-400">attending</span>
                </div>
                {!isPastEvent && (
                    localIsAttending ? (
                        <button onClick={handleLeave} disabled={actionLoading} className="bg-red-600/50 text-red-200 text-sm font-bold py-1 px-3 rounded-md hover:bg-red-600 disabled:opacity-50">
                            Leave
                        </button>
                    ) : (
                        <button onClick={handleAttend} disabled={actionLoading} className="bg-brand-accent text-white text-sm font-bold py-1 px-3 rounded-md hover:bg-blue-600 disabled:opacity-50">
                            Attend
                        </button>
                    )
                )}
            </div>
        </div>
    );
};

const AiEventCard: React.FC<{ event: AiEvent }> = ({ event }) => {
    return (
        <div className="bg-brand-secondary/50 border border-gray-700 p-4 rounded-lg space-y-3">
             <div>
                <h3 className="text-lg font-bold">{event.eventName}</h3>
                <p className="text-xs text-purple-300">Discovered Event</p>
            </div>
            <p className="text-sm text-gray-300">{event.description}</p>
            <div>
                <p className="font-semibold text-brand-accent">{event.date}</p>
                <p className="text-sm text-gray-400">{event.locationString}</p>
            </div>
            <div className="pt-3 border-t border-gray-700">
                <a href={event.sourceURL} target="_blank" rel="noopener noreferrer" className="inline-block bg-gray-600 text-white text-sm font-bold py-1 px-3 rounded-md hover:bg-gray-500">
                    Verify Source
                </a>
            </div>
        </div>
    );
};

const Events: React.FC = () => {
    const { events, attendees, loading, error, attendEvent, unattendEvent } = useData();
    const { user } = useContext(AuthContext) || {};
    const navigate = useNavigate();

    // State for AI-discovered events
    const [aiEvents, setAiEvents] = useState<AiEvent[]>([]);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Derive attendance status directly from the DataContext for a single source of truth
    const userAttendees = useMemo(() => {
        if (!user || !attendees) return new Set<number>();
        const userAttendingEventIds = attendees
            .filter(a => a.user_id === user.id)
            .map(a => a.event_id);
        return new Set(userAttendingEventIds);
    }, [user, attendees]);
    
    const now = new Date();
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(now.getHours() - 12);

    const upcomingEvents = events.filter(e => {
        const endDate = e.end_time ? new Date(e.end_time) : new Date(new Date(e.event_time).getTime() + 2 * 60 * 60 * 1000); // Default 2h duration
        return endDate >= now;
    }).sort((a,b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
    
    const pastEvents = events.filter(e => {
        const endDate = e.end_time ? new Date(e.end_time) : new Date(new Date(e.event_time).getTime() + 2 * 60 * 60 * 1000); // Default 2h duration
        // Show events that ended in the last 12 hours
        return endDate < now && endDate > twelveHoursAgo;
    }).sort((a,b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

    const handleAiSearch = async () => {
        setIsAiSearching(true);
        setAiError(null);
        setAiEvents([]);

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
                let locationQuery = "the user's current city";
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
                if (geoResponse.ok) {
                    const geoData = await geoResponse.json();
                    const city = geoData.address.city || geoData.address.town || geoData.address.county;
                    const country = geoData.address.country;
                    if (city && country) {
                        locationQuery = `${city}, ${country}`;
                    }
                }

                const apiKey = process.env.API_KEY;
                if (!apiKey) throw new Error("API key not configured.");
                
                const ai = new GoogleGenAI({ apiKey });
                
                const prompt = `You are an event discovery assistant. Find a maximum of 20 public, community-focused events in ${locationQuery} happening in the next 7 days. Prioritize events like markets, fairs, free concerts, or local meetups. For each event found, provide its name, a short description, the date, its location, and the source URL. You MUST respond with ONLY a valid JSON array of objects. Each object must have these exact keys: "eventName", "description", "date", "locationString", "sourceURL". If no verifiable events are found, you must return an empty array []. Do not add any introductory text, markdown, or explanations.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        tools: [{ googleSearch: {} }],
                        // This optimization requests the fastest possible response from the model.
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                });

                let jsonStr = response.text.trim();
                
                if (jsonStr.startsWith('```json')) {
                    jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
                } else if (jsonStr.startsWith('```')) {
                     jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
                }

                if (jsonStr.startsWith('[') && jsonStr.endsWith(']')) {
                    try {
                        const eventsArray = JSON.parse(jsonStr);
                        setAiEvents(eventsArray);

                        if (eventsArray.length === 0) {
                            setAiError("No community events were found in your area. Try again later or create your own!");
                        }
                    } catch (parseError: any) {
                        console.error("JSON Parse Error:", parseError, "Raw response:", jsonStr);
                        setAiError("The AI returned a malformed list. Please try again.");
                    }
                } else {
                    console.warn("AI did not return a JSON array. Raw response:", jsonStr);
                    setAiError(jsonStr || "The AI returned an empty response. Please try again.");
                }

            } catch (err: any) {
                console.error("AI Event Search Error:", err);
                setAiError(err.message || "Failed to discover events due to an unknown error.");
            } finally {
                setIsAiSearching(false);
            }
        }, (geoError) => {
            console.error("Geolocation Error:", geoError);
            setAiError("Could not get your location. Please enable location services to discover events.");
            setIsAiSearching(false);
        });
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Community Events</h1>
                <button
                    onClick={() => navigate('/', { state: { settingEvent: true } })}
                    className="flex items-center space-x-2 bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    <span>New Event</span>
                </button>
            </div>
            
            {loading && <p className="text-center py-8 text-gray-400">Loading events...</p>}
            {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>}
            
            {!loading && !error && (
                <>
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">Upcoming</h2>
                        {upcomingEvents.length > 0 ? (
                            upcomingEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    currentUserId={user?.id || ''}
                                    isAttending={userAttendees.has(event.id)}
                                    onAttend={attendEvent}
                                    onLeave={unattendEvent}
                                />
                            ))
                        ) : (
                             <div className="text-center py-8 text-gray-400">
                                <p>No upcoming community events found.</p>
                                <p className="text-sm mt-1">Why not create one?</p>
                            </div>
                        )}
                    </div>

                     {/* AI Discovered Events Section */}
                    <div className="space-y-4 pt-6">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2 sm:border-none sm:pb-0">Discovered Community Happenings</h2>
                             <button
                                onClick={handleAiSearch}
                                disabled={isAiSearching}
                                className="flex items-center justify-center space-x-2 bg-purple-600 text-white font-bold py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                <span>{isAiSearching ? 'Searching...' : 'Discover Nearby Events'}</span>
                            </button>
                        </div>
                        {isAiSearching && <p className="text-center py-8 text-gray-400">Searching for local events...</p>}
                        {aiError && <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{aiError}</p>}
                        {aiEvents.length > 0 && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {aiEvents.map((event, index) => (
                                    <AiEventCard key={index} event={event} />
                                ))}
                            </div>
                        )}
                         {!isAiSearching && aiEvents.length === 0 && !aiError && (
                             <p className="text-center py-4 text-gray-500">Click the button to find more events in your area.</p>
                         )}
                    </div>
                    
                    <div className="space-y-4 pt-6">
                         <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">Past Events</h2>
                         {pastEvents.length > 0 ? (
                            pastEvents.map(event => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    currentUserId={user?.id || ''}
                                    isAttending={userAttendees.has(event.id)}
                                    onAttend={attendEvent}
                                    onLeave={unattendEvent}
                                />
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-400">No events have concluded in the last 12 hours.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Events;