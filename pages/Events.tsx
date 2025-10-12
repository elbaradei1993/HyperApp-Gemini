import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import type { Event } from '../types';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, UserGroupIcon } from '../components/ui/Icons';

interface EventCardProps {
    event: Event;
    currentUserId: string;
    isAttending: boolean;
    onAttend: (eventId: number) => Promise<void>;
    onLeave: (eventId: number) => Promise<void>;
}

const EventCard: React.FC<EventCardProps> = ({ event, currentUserId, isAttending, onAttend, onLeave }) => {
    const { deleteEvent } = useData();
    const [actionLoading, setActionLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleAttend = async () => {
        setActionLoading(true);
        await onAttend(event.id);
        setActionLoading(false);
    };

    const handleLeave = async () => {
        setActionLoading(true);
        await onLeave(event.id);
        setActionLoading(false);
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to permanently delete this event?")) {
            setIsDeleting(true);
            await deleteEvent(event.id);
            // No need to set isDeleting to false as the component will unmount
        }
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
                        {/* Removed Delete Button */}
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
                <div className="flex items-center space-x-2 text-gray-400">
                    <UserGroupIcon className="w-5 h-5"/>
                    <span>{event.attendee_count || 0} attending</span>
                </div>
                {!isPastEvent && (
                    isAttending ? (
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


const Events: React.FC = () => {
    const { events, loading, error, attendEvent, unattendEvent } = useData();
    const { user } = useContext(AuthContext) || {};
    const [userAttendees, setUserAttendees] = useState<Set<number>>(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;
        const fetchUserAttendees = async () => {
            const { data, error } = await supabase
                .from('event_attendees')
                .select('event_id')
                .eq('user_id', user.id);
            if (error) {
                console.error("Failed to fetch user's event attendance:", error);
            } else if (data) {
                setUserAttendees(new Set(data.map(a => a.event_id)));
            }
        };
        fetchUserAttendees();
    }, [user, events]);

    const handleAttend = async (eventId: number) => {
        if (!user) return;
        await attendEvent(eventId);
        setUserAttendees(prev => new Set(prev).add(eventId));
    };

    const handleLeave = async (eventId: number) => {
        await unattendEvent(eventId);
        setUserAttendees(prev => {
            const newSet = new Set(prev);
            newSet.delete(eventId);
            return newSet;
        });
    };
    
    const now = new Date();
    const upcomingEvents = events.filter(e => {
        const endDate = e.end_time ? new Date(e.end_time) : new Date(new Date(e.event_time).getTime() + 2 * 60 * 60 * 1000); // Default 2h duration
        return endDate >= now;
    }).sort((a,b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
    
    const pastEvents = events.filter(e => {
        const endDate = e.end_time ? new Date(e.end_time) : new Date(new Date(e.event_time).getTime() + 2 * 60 * 60 * 1000); // Default 2h duration
        return endDate < now;
    }).sort((a,b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());


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
                                    onAttend={handleAttend}
                                    onLeave={handleLeave}
                                />
                            ))
                        ) : (
                             <div className="text-center py-8 text-gray-400">
                                <p>No upcoming community events found.</p>
                                <p className="text-sm mt-1">Why not create one?</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                         <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">Past Events</h2>
                         {pastEvents.length > 0 ? (
                            pastEvents.slice(0, 10).map(event => ( // Show last 10 past events
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    currentUserId={user?.id || ''}
                                    isAttending={userAttendees.has(event.id)}
                                    onAttend={handleAttend}
                                    onLeave={handleLeave}
                                />
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-400">No past events found.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Events;