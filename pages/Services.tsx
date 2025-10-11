import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { VibeType, Vibe } from '../types';
import { LocationMarkerIcon, LightBulbIcon } from '../components/ui/Icons';

const VIBE_CONFIG = {
  [VibeType.Safe]: { emoji: '😊', color: 'green', textClass: 'text-green-300', bgClass: 'bg-green-500/20', barClass: 'bg-green-500' },
  [VibeType.Uncertain]: { emoji: '🤔', color: 'yellow', textClass: 'text-yellow-300', bgClass: 'bg-yellow-500/20', barClass: 'bg-yellow-500' },
  [VibeType.Tense]: { emoji: '😬', color: 'orange', textClass: 'text-orange-300', bgClass: 'bg-orange-500/20', barClass: 'bg-orange-500' },
  [VibeType.Unsafe]: { emoji: '😡', color: 'red', textClass: 'text-red-300', bgClass: 'bg-red-500/20', barClass: 'bg-red-500' },
};

interface AreaVibeStats {
  dominant: { type: VibeType; percentage: number } | null;
  breakdown: Record<string, number>;
  total: number;
}

// Helper function for client-side distance calculation as a fallback
const haversineDistance = (coords1: { lat: number, lng: number }, coords2: { lat: number, lng: number }): number => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
};


const Services: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [areaVibeStats, setAreaVibeStats] = useState<AreaVibeStats | null>(null);
  const [safetyAdvice, setSafetyAdvice] = useState<string | null>(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const auth = useContext(AuthContext);
  
  // Effect 1: Fetch location, address, and vibe data
  useEffect(() => {
    const fetchPulseData = async () => {
      setPulseLoading(true);
      setError(null);
      
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        try {
            const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const geoData = await geoResponse.json();
            setAddress(geoData.display_name || 'Address not found');
        } catch (e) {
            setAddress('Could not fetch address');
        }
        
        const { data: rpcVibes, error: rpcError } = await supabase.rpc('get_nearby_vibes', {
            user_lat: latitude,
            user_lng: longitude,
            radius_km: 1
        });
        
        let nearbyVibes: Vibe[] | null = null;

        if (rpcError) {
            console.warn(`RPC call failed, falling back to client-side. Error: ${rpcError.message}`);
            const { data: allVibes, error: selectError } = await supabase.from('vibes').select('*');

            if (selectError) {
                setError('Could not fetch area vibes. Please check your network connection and RLS policies.');
                setPulseLoading(false);
                return;
            }

            if (allVibes) {
                nearbyVibes = (allVibes as Vibe[]).filter(vibe => 
                    vibe.location && haversineDistance({ lat: latitude, lng: longitude }, vibe.location) <= 1
                );
            }
        } else {
            nearbyVibes = rpcVibes as Vibe[];
        }
        
        if (!nearbyVibes || nearbyVibes.length === 0) {
            setAreaVibeStats({ dominant: null, breakdown: {}, total: 0 });
            setPulseLoading(false);
            return;
        }

        const vibeCounts = nearbyVibes.reduce<Record<string, number>>((acc, vibe) => {
            if (vibe?.vibe_type && Object.values(VibeType).includes(vibe.vibe_type)) {
                acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
            }
            return acc;
        }, {});
        
        if (Object.keys(vibeCounts).length === 0) {
            setAreaVibeStats({ dominant: null, breakdown: {}, total: 0 });
            setPulseLoading(false);
            return;
        }

        const totalValidVibes = Object.values(vibeCounts).reduce((sum, count) => sum + count, 0);
        const breakdown = Object.fromEntries(Object.values(VibeType).map(type => [type, ((vibeCounts[type] || 0) / totalValidVibes) * 100]));
        const dominantVibeEntry = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0];
        
        setAreaVibeStats({
            dominant: { type: dominantVibeEntry[0] as VibeType, percentage: (dominantVibeEntry[1] / totalValidVibes) * 100 },
            breakdown,
            total: totalValidVibes
        });
        setPulseLoading(false);

      }, (geoError) => {
        setError("Could not get your location. Please enable location services.");
        setPulseLoading(false);
      });
    };
    fetchPulseData();
  }, []);

  // Effect 2: Generate safety advice when vibe stats become available.
  useEffect(() => {
    const generateAdvice = async () => {
      if (!areaVibeStats) return;

      if (!areaVibeStats.dominant?.type) {
        if (areaVibeStats.total === 0) {
          setSafetyAdvice("No recent vibes reported here. Be the first to share the pulse of this area!");
        } else {
           setSafetyAdvice("Could not determine the local vibe from recent reports.");
        }
        setAdviceLoading(false);
        return;
      }
      
      let apiKey: string | undefined;
      try {
        apiKey = process.env.API_KEY;
      } catch (e) {
        apiKey = undefined;
      }

      if (!apiKey) {
        setSafetyAdvice("Smart advice is unavailable: API key not configured.");
        setAdviceLoading(false);
        return;
      }

      setAdviceLoading(true);
      setSafetyAdvice(''); // Clear previous advice before streaming
      try {
        const { GoogleGenAI } = await import('@google/genai');
        if (!GoogleGenAI) throw new Error("GoogleGenAI class not found in module.");

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `The dominant community-reported vibe in this area is "${areaVibeStats.dominant.type}". Provide a single, concise, and actionable safety tip someone can use right now. Start the tip with a verb (e.g., 'Avoid', 'Stick to', 'Keep'). Maximum 20 words.`;
        
        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        
        for await (const chunk of responseStream) {
          setSafetyAdvice(currentAdvice => (currentAdvice || '') + chunk.text);
        }

      } catch (err) {
        console.error("Failed to generate smart advice:", err);
        setSafetyAdvice("Smart advice could not be generated at this time.");
      } finally {
        setAdviceLoading(false);
      }
    };

    generateAdvice();
  }, [areaVibeStats]);


  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };
  
  const reportVibe = (vibeType: VibeType) => {
    setActionLoading(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { error } = await supabase.from('vibes').insert({ 
            user_id: auth?.user?.id, 
            vibe_type: vibeType, 
            location: { lat: position.coords.latitude, lng: position.coords.longitude } 
        });
      if (error) {
          showToast(`Error: ${error.message}`);
      } else {
          showToast(`Vibe '${vibeType}' reported successfully!`);
      }
      setActionLoading(false);
    }, () => { showToast('Error: Unable to get location.'); setActionLoading(false); });
  };

  const sendSOS = () => {
    setActionLoading(true);
     navigator.geolocation.getCurrentPosition(async (position) => {
      const { error } = await supabase.from('sos').insert({ 
            user_id: auth?.user?.id, 
            details: 'SOS Alert Activated', 
            location: { lat: position.coords.latitude, lng: position.coords.longitude } 
        });
      if(error){
          showToast(`Error: ${error.message}`);
      } else {
          showToast(`SOS sent! Help is on the way.`);
      }
      setActionLoading(false);
    }, () => { showToast('Error: Unable to get location.'); setActionLoading(false); });
  };
  
  const SkeletonLoader = () => <div className="h-4 bg-gray-600 rounded w-3/4 animate-pulse"></div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold">Community Pulse</h1>
      {toast && <div className="bg-brand-accent p-3 rounded-md fixed top-4 left-4 right-4 z-[100] shadow-lg animate-fade-in-down">{toast}</div>}
      {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md">{error}</div>}

      <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
        <div className="flex items-center space-x-2 text-gray-400">
            <LocationMarkerIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{pulseLoading ? <SkeletonLoader /> : address}</span>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Current Vibe</h2>
           {pulseLoading ? (
            <div className="space-y-3 pt-2">
              <div className="h-6 bg-gray-600 rounded w-1/2 animate-pulse"></div>
              <div className="h-2 bg-gray-600 rounded w-full animate-pulse"></div>
            </div>
          ) : areaVibeStats && areaVibeStats.total > 0 ? (
            <div>
              <p className={`text-xl font-bold ${VIBE_CONFIG[areaVibeStats.dominant!.type].textClass}`}>
                {areaVibeStats.dominant!.percentage.toFixed(0)}% {areaVibeStats.dominant!.type}
              </p>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-700 mt-2">
                 {Object.entries(areaVibeStats.breakdown).map(([type, percentage]: [string, number]) => (
                   percentage > 0 && <div
                    key={type}
                    className={VIBE_CONFIG[type as VibeType].barClass}
                    style={{ width: `${percentage}%` }}
                    title={`${type}: ${percentage.toFixed(1)}%`}
                  ></div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">Based on {areaVibeStats.total} report{areaVibeStats.total > 1 ? 's' : ''}</p>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No vibes reported in this area yet.</p>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-700/50">
            <div className="flex items-center space-x-2 text-gray-400">
                <LightBulbIcon className="w-5 h-5 flex-shrink-0"/>
                <h2 className="text-lg font-semibold text-white">Smart Safety Tip</h2>
            </div>
            {adviceLoading && !safetyAdvice ? (
              <SkeletonLoader />
            ) : (
              <p className="text-gray-300 italic min-h-[1.5rem]">
                "{safetyAdvice}
                {adviceLoading && <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" style={{ animationDuration: '1s' }}></span>}"
              </p>
            )}
        </div>
      </div>

      <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
        <h2 className="text-lg font-semibold text-white">Report a Vibe</h2>
        <div className="grid grid-cols-2 gap-3">
            {Object.values(VibeType).map(vibe => (
                <button
                    key={vibe}
                    onClick={() => reportVibe(vibe)}
                    disabled={actionLoading}
                    className={`p-3 rounded-md text-center font-semibold transition-transform transform hover:scale-105 ${VIBE_CONFIG[vibe].bgClass} ${VIBE_CONFIG[vibe].textClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <span className="text-xl mr-2">{VIBE_CONFIG[vibe].emoji}</span>
                    {vibe.charAt(0).toUpperCase() + vibe.slice(1)}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-red-900/50 p-4 rounded-lg border border-red-500/30">
        <h2 className="text-lg font-semibold text-red-200">Emergency Alert</h2>
        <p className="text-sm text-red-300 mb-3">Use only in a real emergency. Your location will be shared.</p>
        <button
            onClick={sendSOS}
            disabled={actionLoading}
            className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 transition-colors disabled:bg-red-800 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
        >
            <span className="absolute inset-0 bg-white opacity-20 animate-pulse"></span>
            SEND SOS
        </button>
      </div>

    </div>
  );
};

export default Services;