import React, { useState, useContext } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { VibeType, Vibe } from '../../types';

interface ReportVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VIBE_CONFIG: Record<string, { emoji: string; textClass: string; bgClass: string; displayName: string; }> = {
  [VibeType.Safe]: { emoji: '😊', textClass: 'text-green-300', bgClass: 'bg-green-500/20', displayName: 'Safe' },
  [VibeType.Calm]: { emoji: '😌', textClass: 'text-blue-300', bgClass: 'bg-blue-500/20', displayName: 'Calm' },
  [VibeType.Noisy]: { emoji: '🔊', textClass: 'text-yellow-300', bgClass: 'bg-yellow-500/20', displayName: 'Noisy' },
  [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', textClass: 'text-purple-300', bgClass: 'bg-purple-500/20', displayName: 'LGBTQIA+ Friendly' },
  [VibeType.Suspicious]: { emoji: '🤨', textClass: 'text-orange-300', bgClass: 'bg-orange-500/20', displayName: 'Suspicious' },
  [VibeType.Dangerous]: { emoji: '😠', textClass: 'text-red-300', bgClass: 'bg-red-500/20', displayName: 'Dangerous' },
};

const ReportVibeModal: React.FC<ReportVibeModalProps> = ({ isOpen, onClose }) => {
  const { addLocalVibe, currentLocation, currentAddress, userSettings } = useData();
  const auth = useContext(AuthContext);

  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
        onClose();
        setIsClosing(false);
    }, 300); // Match animation duration
  };

  const reportVibe = (vibeType: VibeType) => {
    if (!auth?.user) return showToast("You must be logged in to report a vibe.");
    if (!currentLocation) return showToast("Could not determine your location to report vibe.");

    setActionLoading(true);
    const locationPayload = `SRID=4326;POINT(${currentLocation.lng} ${currentLocation.lat})`;
    supabase.from('vibes').insert({ user_id: auth.user.id, vibe_type: vibeType, location: locationPayload }).select().single()
    .then(({ data, error }) => {
        if (error) {
            showToast(`Error: ${error.message}`);
        } else if (data) {
            const newVibe: Vibe = {
                id: data.id, created_at: data.created_at, user_id: auth.user!.id, vibe_type: vibeType,
                location: currentLocation, 
                profiles: userSettings.privacy.anonymousByDefault ? undefined : { username: 'You' }
            };
            addLocalVibe(newVibe);
            showToast(`Vibe '${VIBE_CONFIG[vibeType]?.displayName || vibeType}' reported!`);
            setTimeout(handleClose, 1000); // Close modal after showing success toast
        }
    }).finally(() => setActionLoading(false));
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div 
        className={`fixed inset-0 bg-black/70 flex items-end justify-center z-[1000] p-4 transition-opacity duration-300 ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
    >
      {toast && <div className="bg-brand-accent p-3 rounded-md fixed top-20 left-4 right-4 z-[100] shadow-lg animate-fade-in-down">{toast}</div>}
      <div 
        className={`bg-brand-secondary rounded-lg shadow-xl w-full max-w-md relative transition-transform duration-300 ${isOpen && !isClosing ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Report a Vibe</h2>
                <p className="text-sm text-gray-400">What's the pulse of your current location?</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{currentAddress || "Getting your location..."}</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {Object.entries(VIBE_CONFIG).map(([vibe, config]) => (
                    <button key={vibe} onClick={() => reportVibe(vibe as VibeType)} disabled={actionLoading} className={`p-4 rounded-lg text-center font-semibold transition-transform transform hover:scale-105 ${config.bgClass} ${config.textClass} disabled:opacity-50 disabled:cursor-wait`}>
                        <span className="text-3xl">{config.emoji}</span>
                        <p className="mt-1">{config.displayName}</p>
                    </button>
                ))}
            </div>
            <button onClick={handleClose} className="w-full mt-2 bg-gray-700 text-white font-bold py-3 px-4 rounded-md hover:bg-gray-600">
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReportVibeModal;