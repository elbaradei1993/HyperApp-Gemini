import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import type { Event as CommunityEvent } from '../types';
import { timeAgo } from '../utils/time';
import { TrashIcon, PencilSquareIcon, UserGroupIcon, PlusCircleIcon } from '../components/ui/Icons';

const CommunityEventCard: React.FC<{ event: CommunityEvent }> = ({ event }) => {
  const auth = useContext(AuthContext);
  const { userAttendees, attendEvent, unattendEvent, deleteLocalEvent } = useData();
  const navigate = useNavigate();

  const isOwner = event.user_id === auth?.user?.id;
  const isAttending = userAttendees.some(a => a.event_id === event.id && a.user_id === auth?.user?.id);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this event? This cannot be undone.")) {
      // Optimistic UI update
      deleteLocalEvent(event.id);
      // DB operation
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) {
        alert(`Error: ${error.message}`);
        // Consider reverting the optimistic update on error
      }
    }
  };

  const handleAttendToggle = () => {
    if (isAttending) {
      unattendEvent(event.id);
    } else {
      attendEvent(event.id);
    }
  };

  return (
    <div className="bg-brand-secondary p-4 rounded-lg space-y-3 relative">
      <div className="pr-16">
        <h3 className="text-lg font-bold text-white">{event.title}</h3>
        <p className="text-sm text-gray-400">
          By {event.profiles?.username || 'anonymous'} • {timeAgo(event.created_at)}
        </p>
      </div>
      
      {event.description && <p className="text-gray-300 whitespace-pre-wrap">{event.description}</p>}
      
      <div className="flex justify-between items-center pt-2 border-t border-gray-600/50">
        <div className="text-xs font-semibold text-brand-accent">
          {new Date(event.event_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
            <UserGroupIcon className="w-5 h-5"/>
            <span className="text-sm font-medium">{event.attendee_count || 0}</span>
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center space-x-2">
        {isOwner ? (
          <>
            <button onClick={() => navigate(`/edit-event/${event.id}`)} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"><PencilSquareIcon className="w-5 h-5" /></button>
            <button onClick={handleDelete} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-red-400 transition-colors"><TrashIcon className="w-5 h-5" /></button>
          </>
        ) : (
           <button 
             onClick={handleAttendToggle}
             className={`px-4 py-1.5 text-sm font-bold rounded-full transition-colors ${isAttending ? 'bg-red-600/50 text-red-200 hover:bg-red-600/80' : 'bg-brand-accent text-white hover:bg-blue-600'}`}
           >
             {isAttending ? 'Un-attend' : 'Attend'}
           </button>
        )}
      </div>
    </div>
  );
};

const Events: React.FC = () => {
    const { events, loading, error } = useData();
    const navigate = useNavigate();

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Community Events</h1>

            {loading ? <p className="text-center py-8 text-gray-400">Loading events...</p>
            : error ? <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>
            : events.length === 0 ? (
                <div className="text-center py-12 px-4 bg-brand-secondary rounded-lg">
                    <h2 className="text-xl font-semibold text-white mb-2">No Events Nearby</h2>
                    <p className="text-gray-400 mb-6">Be the first to create an event and bring your community together!</p>
                    <button 
                      onClick={() => navigate('/', { state: { settingEvent: true } })} 
                      className="inline-flex items-center justify-center space-x-2 bg-brand-accent text-white font-bold py-3 px-6 rounded-full hover:bg-blue-600 transition-transform transform hover:scale-105"
                    >
                      <PlusCircleIcon className="w-6 h-6" />
                      <span>Create New Event</span>
                    </button>
                </div>
            )
            : (
                <div className="space-y-4">
                    {events.map(event => <CommunityEventCard key={event.id} event={event} />)}
                </div>
            )}
        </div>
    );
};

export default Events;