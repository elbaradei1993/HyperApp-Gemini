import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { VibeType, NewsItem, WeatherInfo } from '../types';
import { LocationMarkerIcon, LightBulbIcon, MicrophoneIcon, SunIcon, CloudIcon, CloudRainIcon, BoltIcon, SnowflakeIcon } from '../components/ui/Icons';
import { getNearbyPlacesList } from '../services/osmApiService';
import { haversineDistance } from '../utils/geolocation';
import { GoogleGenAI } from '@google/genai';
import LiveAssistantModal from '../components/services/LiveAssistantModal';

// --- Shared Vibe Configuration ---
const VIBE_CONFIG: Record<string, { emoji: string; textClass: string; bgClass: string; barClass: string; displayName: string; }> = {
  [VibeType.Safe]: { emoji: '😊', textClass: 'text-green-300', bgClass: 'bg-green-500/20', barClass: 'bg-green-500', displayName: 'Safe' },
  [VibeType.Calm]: { emoji: '😌', textClass: 'text-blue-300', bgClass: 'bg-blue-500/20', barClass: 'bg-blue-500', displayName: 'Calm' },
  [VibeType.Noisy]: { emoji: '🔊', textClass: 'text-yellow-300', bgClass: 'bg-yellow-500/20', barClass: 'bg-yellow-500', displayName: 'Noisy' },
  [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', textClass: 'text-purple-300', bgClass: 'bg-purple-500/20', barClass: 'bg-purple-500', displayName: 'LGBTQIA+ Friendly' },
  [VibeType.Suspicious]: { emoji: '🤨', textClass: 'text-orange-300', bgClass: 'bg-orange-500/20', barClass: 'bg-orange-500', displayName: 'Suspicious' },
  [VibeType.Dangerous]: { emoji: '😠', textClass: 'text-red-300', bgClass: 'bg-red-500/20', barClass: 'bg-red-500', displayName: 'Dangerous' },
};

// --- Briefing Components ---
const WeatherWidget: React.FC<{ weather: WeatherInfo }> = ({ weather }) => {
    const WeatherIcon = useMemo(() => {
        const iconKeyword = weather.icon.toLowerCase();
        if (iconKeyword.includes('sun') || iconKeyword.includes('clear')) return SunIcon;
        if (iconKeyword.includes('cloud')) return CloudIcon;
        if (iconKeyword.includes('rain') || iconKeyword.includes('shower')) return CloudRainIcon;
        if (iconKeyword.includes('storm') || iconKeyword.includes('thunder')) return BoltIcon;
        if (iconKeyword.includes('snow')) return SnowflakeIcon;
        return CloudIcon;
    }, [weather.icon]);

    return (
        <div className="bg-brand-primary/50 p-3 rounded-lg flex items-center space-x-4">
            <WeatherIcon className="w-10 h-10 text-blue-300 flex-shrink-0" />
            <div>
                <p className="font-bold text-white text-lg">{weather.text}</p>
                <p className="text-xs text-gray-400">Current Conditions</p>
            </div>
        </div>
    );
};

const NewsCard: React.FC<{ item: NewsItem; onClick: () => void }> = ({ item, onClick }) => {
    return (
        <button onClick={onClick} className="w-full text-left bg-brand-primary/50 p-3 rounded-lg hover:bg-gray-800 transition-colors">
            <h4 className="font-bold text-white">{item.headline}</h4>
            <p className="text-sm text-gray-400 mt-1">{item.summary}</p>
        </button>
    );
};

const NewsDetailsModal: React.FC<{ item: NewsItem | null; onClose: () => void }> = ({ item, onClose }) => {
    if (!item) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">{item.headline}</h2>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{item.summary}</p>
                </div>
                <div className="mt-6">
                    <button onClick={onClose} className="w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-md">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Unified Pulse Component ---
interface AreaVibeStats {
  dominant: { type: VibeType; percentage: number } | null;
  breakdown: Record<string, number>;
  total: number;
}

const Pulse: React.FC = () => {
  const { 
    vibes, loading: dataLoading, error: dataError,
    currentLocation, currentAddress,
    liveBriefing, liveBriefingLoading, liveBriefingError, fetchLiveBriefing
  } = useData();

  const [areaVibeStats, setAreaVibeStats] = useState<AreaVibeStats | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<string[] | null>(null);
  const [safetyAdvice, setSafetyAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [selectedNewsItem, setSelectedNewsItem] = useState<NewsItem | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  useEffect(() => {
    if (currentLocation) {
        fetchLiveBriefing();
    }
  }, [currentLocation, fetchLiveBriefing]);
  
  useEffect(() => {
    const fetchAndSetNearbyPlaces = async () => {
        if (currentLocation) {
            const places = await getNearbyPlacesList(currentLocation, 500);
            setNearbyPlaces(places);
        }
    };
    fetchAndSetNearbyPlaces();
  }, [currentLocation]);

  useEffect(() => {
    if (!currentLocation || dataLoading) return;
    const nearbyVibes = vibes.filter(vibe => haversineDistance(currentLocation, vibe.location) <= 1);
    if (nearbyVibes.length === 0) {
        setAreaVibeStats({ dominant: null, breakdown: {}, total: 0 });
    } else {
        const vibeCounts = nearbyVibes.reduce<Record<string, number>>((acc, vibe) => {
            acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
            return acc;
        }, {});
        const total = nearbyVibes.length;
        const breakdown = Object.fromEntries(
            // FIX: Cast count to number to ensure type safety in arithmetic operation.
            Object.entries(vibeCounts).map(([type, count]) => [type, ((count as number) / total) * 100])
        );
        // FIX: Cast countA and countB to number to ensure type safety in sort comparison.
        const dominantVibeEntry = Object.entries(vibeCounts).sort(([, countA], [, countB]) => (countB as number) - (countA as number))[0];
        setAreaVibeStats({
            // FIX: Cast dominantVibeEntry[1] to number to ensure type safety in percentage calculation.
            dominant: { type: dominantVibeEntry[0] as VibeType, percentage: ((dominantVibeEntry[1] as number) / total) * 100 },
            breakdown, total
        });
    }
  }, [vibes, currentLocation, dataLoading]);

  useEffect(() => {
    const generateAdvice = async () => {
      if (!areaVibeStats || nearbyPlaces === null) return;
      if (areaVibeStats.total === 0) {
          setSafetyAdvice("No recent vibes reported here. Be the first to share the pulse of this area!");
          setAdviceLoading(false);
          return;
      }
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        setSafetyAdvice("Smart advice is unavailable: API key not configured.");
        setAdviceLoading(false); return;
      }
      setAdviceLoading(true);
      setSafetyAdvice('');
      try {
        const ai = new GoogleGenAI({ apiKey });
        const timeOfDay = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const breakdownText = Object.entries(areaVibeStats.breakdown)
            // FIX: Cast p to number to ensure type safety in comparison.
            .filter(([, p]) => (p as number) > 0)
            // FIX: Cast p to number to use toFixed method.
            .map(([type, p]) => `${(p as number).toFixed(0)}% ${VIBE_CONFIG[type]?.displayName || type}`).join(', ');
        let context = `--- CONTEXT ---\n- Time: ${timeOfDay}\n- Community Vibe: ${breakdownText}\n`;
        if (nearbyPlaces.length > 0) context += `- Nearby Places: ${nearbyPlaces.slice(0, 5).join(', ')}\n`;
        context += `--- END CONTEXT ---\n\n`;
        const prompt = context + `You are a community safety assistant. 1. In one sentence, explain the likely reason for the current vibe. 2. On a new line, provide a single, practical safety tip relevant to your explanation.`;
        const responseStream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: prompt, config: { thinkingConfig: { thinkingBudget: 0 } } });
        for await (const chunk of responseStream) {
          setSafetyAdvice(prev => (prev || '') + chunk.text);
        }
      } catch (err: any) {
        setSafetyAdvice("Smart explanation could not be generated.");
      } finally {
        setAdviceLoading(false);
      }
    };
    generateAdvice();
  }, [areaVibeStats, nearbyPlaces]);
  
  const SkeletonLoader = () => <div className="h-4 bg-gray-600 rounded w-3/4 animate-pulse"></div>;

  return (
    <div className="p-4 space-y-6">
      
      <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
          <h1 className="text-2xl font-bold text-white">Live Community Briefing</h1>
          {(liveBriefingLoading && !liveBriefing) ? (
              <p className="text-gray-400 text-center py-4">Generating your live briefing...</p>
          ) : liveBriefingError ? (
              <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{liveBriefingError}</p>
          ) : liveBriefing ? (
              <div className="space-y-4">
                  {liveBriefing.weather && <WeatherWidget weather={liveBriefing.weather} />}
                  <div className="space-y-2">
                     {liveBriefing.news.length > 0 ? (
                          liveBriefing.news.map((item, index) => (
                              <NewsCard key={index} item={item} onClick={() => setSelectedNewsItem(item)} />
                          ))
                     ) : (
                          <p className="text-gray-400 text-center py-2">No significant news to report in your area right now.</p>
                     )}
                  </div>
              </div>
          ) : <p className="text-gray-400 text-center py-4">Getting your location to generate briefing...</p>}
      </div>

      <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
        {dataError && <div className="bg-red-500/20 text-red-300 p-3 rounded-md">{dataError}</div>}
        <div className="flex items-center space-x-2 text-gray-400">
            <LocationMarkerIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{!currentAddress ? <SkeletonLoader /> : currentAddress}</span>
        </div>
        
        <div className="space-y-2">
           {(dataLoading || !areaVibeStats) ? (
                <h2 className="text-lg font-semibold text-white">Analyzing Local Vibe...</h2>
            ) : areaVibeStats.dominant ? (
                <div className="flex items-center space-x-3">
                    <span className="text-3xl">{VIBE_CONFIG[areaVibeStats.dominant.type]?.emoji}</span>
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Dominant Vibe: <span className={VIBE_CONFIG[areaVibeStats.dominant.type]?.textClass}>{VIBE_CONFIG[areaVibeStats.dominant.type]?.displayName}</span>
                        </h2>
                        <p className="text-xs text-gray-400">({areaVibeStats.dominant.percentage.toFixed(0)}% of reports in this area)</p>
                    </div>
                </div>
            ) : (
                <h2 className="text-lg font-semibold text-white">Current Vibe Breakdown</h2>
            )}
           {(dataLoading || !areaVibeStats) ? (
            <div className="space-y-3 pt-2"><div className="h-6 bg-gray-600 rounded w-1/2 animate-pulse"></div><div className="h-2 bg-gray-600 rounded w-full animate-pulse"></div></div>
          ) : areaVibeStats.total > 0 ? (
            <div>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-700 mt-2">
                 {/* FIX: Cast valA and valB to number for sorting comparison. */}
                 {Object.entries(areaVibeStats.breakdown).sort(([, valA], [, valB]) => (valB as number) - (valA as number)).map(([type, percentage]) => {
                    const config = VIBE_CONFIG[type];
                    // FIX: Cast percentage to number for comparison.
                    if (!config || (percentage as number) <= 0) return null;
                    // FIX: Cast percentage to number to use toFixed method.
                    return <div key={type} className={config.barClass} style={{ width: `${percentage}%` }} title={`${config.displayName}: ${(percentage as number).toFixed(1)}%`}></div>
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
            {adviceLoading ? (
              <SkeletonLoader />
            ) : (
              <p className="text-gray-300 italic min-h-[4rem] whitespace-pre-wrap">
                {safetyAdvice}
              </p>
            )}
        </div>
      </div>

      <div className="bg-red-900/50 p-4 rounded-lg border border-red-500/30">
        <h2 className="text-lg font-semibold text-red-200">Emergency Assistance</h2>
        <p className="text-sm text-red-300 mb-3">If you are in danger, connect to our live AI assistant for immediate help.</p>
        <button onClick={() => setIsAssistantOpen(true)} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center space-x-2">
            <MicrophoneIcon className="w-6 h-6" />
            <span>START LIVE ASSISTANCE</span>
        </button>
      </div>

      <LiveAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
      <NewsDetailsModal item={selectedNewsItem} onClose={() => setSelectedNewsItem(null)} />
    </div>
  );
};

export default Pulse;
