

import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { VibeType, Vibe } from '../types';
import { LocationMarkerIcon, LightBulbIcon, SearchIcon, MicrophoneIcon } from '../components/ui/Icons';
import { getNearbyPlacesList } from '../services/osmApiService';
import { haversineDistance } from '../utils/geolocation';
import { GoogleGenAI } from '@google/genai';
import LiveAssistantModal from '../components/services/LiveAssistantModal';

const VIBE_CONFIG: Record<string, { emoji: string; color: string; textClass: string; bgClass: string; barClass: string; displayName: string; }> = {
  [VibeType.Safe]: { emoji: '😊', color: 'green', textClass: 'text-green-300', bgClass: 'bg-green-500/20', barClass: 'bg-green-500', displayName: 'Safe' },
  [VibeType.Calm]: { emoji: '😌', color: 'blue', textClass: 'text-blue-300', bgClass: 'bg-blue-500/20', barClass: 'bg-blue-500', displayName: 'Calm' },
  [VibeType.Noisy]: { emoji: '🔊', color: 'yellow', textClass: 'text-yellow-300', bgClass: 'bg-yellow-500/20', barClass: 'bg-yellow-500', displayName: 'Noisy' },
  [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', color: 'purple', textClass: 'text-purple-300', bgClass: 'bg-purple-500/20', barClass: 'bg-purple-500', displayName: 'LGBTQIA+ Friendly' },
  [VibeType.Suspicious]: { emoji: '🤨', color: 'orange', textClass: 'text-orange-300', bgClass: 'bg-orange-500/20', barClass: 'bg-orange-500', displayName: 'Suspicious' },
  [VibeType.Dangerous]: { emoji: '😠', color: 'red', textClass: 'text-red-300', bgClass: 'bg-red-500/20', barClass: 'bg-red-500', displayName: 'Dangerous' },
};

interface AreaVibeStats {
  dominant: { type: VibeType; percentage: number } | null;
  breakdown: Record<string, number>;
  total: number;
}

interface SafetyBriefing {
    summary: string;
    sources: { uri: string, title: string }[];
}

const Services: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [areaVibeStats, setAreaVibeStats] = useState<AreaVibeStats | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<string[] | null>(null);
  const [safetyAdvice, setSafetyAdvice] = useState<string | null>(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const auth = useContext(AuthContext);

  // New state for Safety Briefing
  const [briefingLocation, setBriefingLocation] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingResult, setBriefingResult] = useState<SafetyBriefing | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  // New state for Live Assistant
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  // Effect 1: Fetch location, address, vibe data, and nearby places
  useEffect(() => {
    const fetchPulseData = async () => {
      setPulseLoading(true);
      setError(null);
      
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        // Fetch address and nearby places concurrently for speed
        const [geoResponse, places] = await Promise.all([
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`),
            getNearbyPlacesList({ lat: latitude, lng: longitude }, 500)
        ]);

        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            const currentAddress = geoData.display_name || 'Address not found';
            setAddress(currentAddress);
            setBriefingLocation(currentAddress);
        } else {
            setAddress('Could not fetch address');
        }
        setNearbyPlaces(places);
        
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
        
        const validVibeTypes = new Set(Object.values(VibeType));
        const validNearbyVibes = (nearbyVibes || []).filter(v => v.vibe_type && validVibeTypes.has(v.vibe_type as VibeType));

        if (validNearbyVibes.length === 0) {
            setAreaVibeStats({ dominant: null, breakdown: {}, total: 0 });
            setPulseLoading(false);
            return;
        }

        const vibeCounts = validNearbyVibes.reduce<Record<string, number>>((acc, vibe) => {
            acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
            return acc;
        }, {});
        
        const totalValidVibes = validNearbyVibes.length;
        const breakdown = Object.fromEntries(
            Object.entries(vibeCounts).map(([type, count]) => [type, (count / totalValidVibes) * 100])
        );

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

  // Effect 2: Generate safety advice when vibe stats and places become available.
  useEffect(() => {
    const generateAdvice = async () => {
      if (!areaVibeStats || nearbyPlaces === null) return;

      if (areaVibeStats.total === 0) {
          setSafetyAdvice("No recent vibes reported here. Be the first to share the pulse of this area!");
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
        if (!GoogleGenAI) throw new Error("GoogleGenAI class not found in module.");

        const ai = new GoogleGenAI({ apiKey });

        const date = new Date();
        const timeOfDay = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' });

        let context = `--- CONTEXT DATA ---\n`;
        context += `- Time: ${timeOfDay} on a ${dayOfWeek}\n`;
        if (areaVibeStats.total > 0 && areaVibeStats.dominant) {
            const breakdownText = Object.entries(areaVibeStats.breakdown)
                .filter(([, percentage]) => (percentage as number) > 0)
                .map(([type, percentage]) => `${(percentage as number).toFixed(0)}% ${VIBE_CONFIG[type].displayName}`)
                .join(', ');
            context += `- Community Vibe Breakdown: ${breakdownText}\n`;
        } else {
            context += `- Community Vibe Breakdown: No recent reports in this area.\n`;
        }
    
        if (nearbyPlaces.length > 0) {
            context += `- Nearby Points of Interest: ${nearbyPlaces.slice(0, 5).join(', ')}\n`; // Limit to 5 for brevity
        } else {
            context += `- Nearby Points of Interest: None detected.\n`;
        }
        context += `--- END CONTEXT DATA ---\n\n`;
    
        const prompt = context + `You are a helpful community safety assistant. Your task is to provide a "Vibe Explanation" based on the new vibe categories:
- Safe: General feeling of security.
- Calm: Peaceful and quiet, low activity.
- Noisy: High level of sound, can be from traffic, construction, or crowds. Neutral to negative.
- LGBTQIA+ Friendly: A welcoming and inclusive atmosphere for LGBTQIA+ individuals.
- Suspicious: Something feels off or unsettling, but no immediate danger is perceived.
- Dangerous: A clear and present sense of threat or hostile activity.

Based on this, do the following:
1. First, in one friendly sentence, EXPLAIN the likely reason for the current community vibe using the context data provided. Be insightful.
2. Then, on a new line, provide a single, practical, and actionable safety tip that is relevant to your explanation. Start this tip with a verb.

Example:
The area feels welcoming and calm, likely due to the nearby park and several cafes creating a relaxed daytime atmosphere.

Take a moment to enjoy a walk, but always be aware of your surroundings.`;
        
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

      } catch (err: any) {
        console.error("Failed to generate smart advice:", err.message);
        setSafetyAdvice("Smart explanation could not be generated at this time.");
      } finally {
        setAdviceLoading(false);
      }
    };

    generateAdvice();
  }, [areaVibeStats, nearbyPlaces]);

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
          showToast(`Vibe '${VIBE_CONFIG[vibeType]?.displayName || vibeType}' reported successfully!`);
      }
      setActionLoading(false);
    }, () => { showToast('Error: Unable to get location.'); setActionLoading(false); });
  };

  const handleGenerateBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefingLocation) {
        setBriefingError("Please enter a location.");
        return;
    }

    setBriefingLoading(true);
    setBriefingResult(null);
    setBriefingError(null);

    try {
        let apiKey: string | undefined;
        try { apiKey = process.env.API_KEY; } catch (e) { /* ignore */ }
        if (!apiKey) throw new Error("API key not configured.");

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Generate a very brief and helpful safety briefing (2-3 sentences max) for a visitor to "${briefingLocation}". Analyze recent events and safety perceptions. Provide a summary in a friendly, easy-to-understand paragraph, and conclude with one practical safety tip.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const summary = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .map((chunk: any) => chunk.web)
            .filter((web: any) => web?.uri && web?.title)
            .reduce((acc: any[], current: any) => { // Deduplicate sources by URI
                if (!acc.find(item => item.uri === current.uri)) {
                    acc.push(current);
                }
                return acc;
            }, []);
        
        setBriefingResult({ summary, sources });

    } catch (error: any) {
        setBriefingError(error.message || "Failed to generate safety briefing.");
    } finally {
        setBriefingLoading(false);
    }
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
                {areaVibeStats.dominant!.percentage.toFixed(0)}% {VIBE_CONFIG[areaVibeStats.dominant!.type].displayName}
              </p>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-700 mt-2">
                 {Object.entries(areaVibeStats.breakdown).map(([type, percentage]) => {
                    const config = VIBE_CONFIG[type];
                    if (!config) return null; // Should not happen due to filtering
                    return <div
                      key={type}
                      className={config.barClass}
                      style={{ width: `${percentage}%` }}
                      title={`${config.displayName}: ${(percentage as number).toFixed(1)}%`}
                    ></div>
                 })}
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
                <h2 className="text-lg font-semibold text-white">Smart Vibe Explanation</h2>
            </div>
            {adviceLoading && !safetyAdvice ? (
              <SkeletonLoader />
            ) : (
              <p className="text-gray-300 italic min-h-[4rem] whitespace-pre-wrap">
                {safetyAdvice}
                {adviceLoading && <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" style={{ animationDuration: '1s' }}></span>}
              </p>
            )}
        </div>
      </div>
      
      <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
        <h2 className="text-lg font-semibold text-white">Proactive Safety Briefing</h2>
        <form onSubmit={handleGenerateBriefing} className="space-y-3">
            <div className="relative">
                <input
                    type="text"
                    value={briefingLocation}
                    onChange={(e) => setBriefingLocation(e.target.value)}
                    placeholder="Enter an address or neighborhood..."
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 pl-10 focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    aria-label="Location for safety briefing"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button
                type="submit"
                disabled={briefingLoading}
                className="w-full bg-brand-accent text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:bg-gray-500"
            >
                {briefingLoading ? 'Generating...' : 'Get Briefing'}
            </button>
        </form>

        {briefingError && <p className="bg-red-500/20 text-red-400 p-3 rounded-md mt-4 text-sm">{briefingError}</p>}

        {briefingResult && (
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <h3 className="font-semibold">Briefing for: {briefingLocation}</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{briefingResult.summary}</p>
                {briefingResult.sources.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-400">Sources:</h4>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                            {briefingResult.sources.map((source, i) => (
                                <li key={i}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                                        {source.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}
      </div>


      <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
        <h2 className="text-lg font-semibold text-white">Report a Vibe</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(VIBE_CONFIG).map(([vibe, config]) => (
                <button
                    key={vibe}
                    onClick={() => reportVibe(vibe as VibeType)}
                    disabled={actionLoading}
                    className={`p-3 rounded-md text-center font-semibold transition-transform transform hover:scale-105 ${config.bgClass} ${config.textClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <span className="text-xl mr-2">{config.emoji}</span>
                    {config.displayName}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-red-900/50 p-4 rounded-lg border border-red-500/30">
        <h2 className="text-lg font-semibold text-red-200">Emergency Assistance</h2>
        <p className="text-sm text-red-300 mb-3">If you are in danger, connect to our live AI assistant for immediate help.</p>
        <button
            onClick={() => setIsAssistantOpen(true)}
            disabled={actionLoading}
            className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 transition-colors disabled:bg-red-800 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden flex items-center justify-center space-x-2"
        >
            <MicrophoneIcon className="w-6 h-6" />
            <span>START LIVE ASSISTANCE</span>
        </button>
      </div>

      <LiveAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </div>
  );
};

export default Services;
