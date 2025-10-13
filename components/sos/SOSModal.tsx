import React, { useState, useEffect, useRef, useContext } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { MicrophoneIcon, StopCircleIcon, ExclamationTriangleIcon } from '../ui/Icons';
import type { SOS, Location } from '../../types';

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

const SOSModal: React.FC<SOSModalProps> = ({ isOpen, onClose }) => {
  const [details, setDetails] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false); // For getting location before confirmation
  const [error, setError] = useState<string | null>(null);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmData, setConfirmData] = useState<{ location: Location; address: string } | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const auth = useContext(AuthContext);
  const { addLocalSOS } = useData();

  useEffect(() => {
    if (!isOpen) return;

    if (isSpeechRecognitionSupported) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        setDetails(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        let friendlyError = `Speech recognition error: ${event.error}`;
        switch(event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
                friendlyError = "Microphone permission denied. Please enable it in your browser settings and try again.";
                break;
            case 'network':
                friendlyError = "Network error. Please check your internet connection and try again.";
                break;
            case 'no-speech':
                friendlyError = "No speech was detected. Please try speaking clearly.";
                break;
            case 'aborted':
                friendlyError = "Recording was aborted. Please try again.";
                break;
        }
        setError(friendlyError);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
          // Check the state ref to see if the stop was intentional or from an error
          setIsRecording(false);
      }
      
    } else {
      setError('Speech recognition is not supported in your browser.');
    }
    
    return () => {
        if(recognitionRef.current){
            recognitionRef.current.stop();
        }
    }
  }, [isOpen]);

  const handleRecordToggle = () => {
    if (!isSpeechRecognitionSupported) return;
    
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false); // Manually set state as onend can be delayed
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
      setError(null);
    }
  };
  
  const handleInitiateSubmit = async () => {
    if (!details.trim()) {
      setError('Please provide details about the emergency.');
      return;
    }
    if (!auth?.user) {
        setError('You must be logged in to send an alert.');
        return;
    }
    
    setIsPreparing(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const location = { lat: latitude, lng: longitude };
      let address = "Location confirmed, address unavailable.";

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (response.ok) {
          const data = await response.json();
          address = data.display_name || "Could not fetch address details.";
        }
      } catch (e) {
        console.warn("Reverse geocoding failed for confirmation:", e);
      }

      setConfirmData({ location, address });
      setShowConfirmation(true);
      setIsPreparing(false);
    }, (geoError) => {
      setError(`Location services unavailable: ${geoError.message}. Please enable location in your device settings.`);
      setIsPreparing(false);
    });
  };

  const handleConfirmSend = async () => {
    if (!confirmData || !auth?.user) {
      setError('Confirmation data is missing. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { lat, lng } = confirmData.location;
    const locationPayload = `SRID=4326;POINT(${lng} ${lat})`;

    const { data, error: insertError } = await supabase
      .from('sos')
      .insert({
        user_id: auth.user!.id,
        details,
        location: locationPayload,
      })
      .select()
      .single();
      
    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
    } else if (data) { // FIX: Add a check for `data` to prevent a crash if the insert succeeds but RLS prevents returning the row.
        const newSOS: SOS = {
            id: data.id,
            created_at: data.created_at,
            user_id: auth.user!.id,
            details: data.details,
            location: { lat, lng },
            profiles: { username: 'You' }
        };
        addLocalSOS(newSOS);
        
        // Play confirmation sound
        audioRef.current?.play().catch(e => console.error("Audio play failed:", e));

        alert("SOS Alert has been sent to the community!");
        setIsSubmitting(false);
        handleClose();
    }
  };
  
  const handleClose = () => {
      if (isRecording) {
          recognitionRef.current?.stop();
      }
      setIsRecording(false);
      setDetails('');
      setError(null);
      setIsSubmitting(false);
      setIsPreparing(false);
      setShowConfirmation(false);
      setConfirmData(null);
      onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000] p-4" onClick={handleClose}>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/emergency/beeper_confirm.ogg" preload="auto" className="hidden" aria-hidden="true" />
      <div 
        className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-md relative animate-fade-in-down border-2 border-red-500/50"
        onClick={e => e.stopPropagation()}
      >
        {showConfirmation && confirmData ? (
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-center text-yellow-300">Confirm SOS Alert</h2>
            <div className="bg-brand-primary p-3 rounded-md space-y-2 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400">DETAILS</p>
                <p className="text-white whitespace-pre-wrap leading-tight">{details}</p>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs font-semibold text-gray-400">LOCATION (APPROXIMATE)</p>
                <p className="text-white">{confirmData.address}</p>
              </div>
            </div>
            <p className="text-sm text-center text-red-300">This action cannot be undone. Are you sure you want to send this alert to the community?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={isSubmitting}
                className="flex-1 bg-gray-600 text-white font-bold py-3 px-4 rounded-md hover:bg-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 disabled:bg-red-800 disabled:cursor-wait"
              >
                {isSubmitting ? 'Sending...' : 'CONFIRM & SEND'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
              <div className="text-center">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold text-white">Emergency SOS</h2>
                  <p className="text-sm text-gray-400">Only use this in a genuine emergency. Your location will be shared with the community.</p>
              </div>
              
              {error && <p className="bg-red-900/50 text-red-300 p-3 rounded-md text-sm text-center">{error}</p>}
              
              <div className="space-y-2">
                  <label htmlFor="details" className="block text-sm font-medium text-gray-300">
                      Briefly describe the situation:
                  </label>
                  <textarea 
                      id="details"
                      rows={4}
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      placeholder="e.g., 'Suspicious person following me near the park entrance.'"
                      className="w-full bg-brand-primary text-white border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
              </div>
              
              <button
                  type="button"
                  onClick={handleRecordToggle}
                  disabled={!isSpeechRecognitionSupported || isSubmitting || isPreparing}
                  className={`w-full flex items-center justify-center space-x-2 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50
                    ${isRecording 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white ring-4 ring-yellow-500/50 animate-pulse' 
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                    }`
                  }
              >
                  {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                  <span>{isRecording ? 'Stop Recording' : 'Record Details with Voice'}</span>
              </button>
              
              <div className="flex space-x-3 pt-4">
                  <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting || isPreparing}
                      className="flex-1 bg-gray-700 text-white font-bold py-3 px-4 rounded-md hover:bg-gray-600 disabled:opacity-50"
                  >
                      Cancel
                  </button>
                  <button
                      type="button"
                      onClick={handleInitiateSubmit}
                      disabled={isSubmitting || isPreparing || !details.trim()}
                      className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed"
                  >
                      {isPreparing ? 'Getting Location...' : 'SEND ALERT'}
                  </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SOSModal;