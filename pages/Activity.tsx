import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { haversineDistance } from '../utils/geolocation';
import { GoogleGenAI } from '@google/genai';
import { Vibe, SOS, Location, VibeType } from '../types';
import { FireIcon, BellAlertIcon, SunIcon, CloudIcon, CloudRainIcon, BoltIcon, SnowflakeIcon } from '../components/ui/Icons';
import { ActivityCard } from '../components/activity/ActivityCard';

// --- Vibe Configuration ---
const VIBE_CONFIG: Record<string, { emoji: string; displayName: string; textClass: string; barClass: string }> = {
    [VibeType.Safe]: { emoji: '😊', displayName: 'Safe', textClass: 'text-green-300', barClass: 'bg-green-500' },
    [VibeType.Calm]: { emoji: '😌', displayName: 'Calm', textClass: 'text-blue-300', barClass: 'bg-blue-500' },
    [VibeType.Noisy]: { emoji: '🔊', displayName: 'Noisy', textClass: 'text-yellow-300', barClass: 'bg-yellow-500' },
    [VibeType.LGBTQIAFriendly]: { emoji: '🏳️‍🌈', displayName: 'LGBTQIA+ Friendly', textClass: 'text-purple-300', barClass: 'bg-purple-500' },
    [VibeType.Suspicious]: { emoji: '🤨', displayName: 'Suspicious', textClass: 'text-orange-300', barClass: 'bg-orange-500' },
    [VibeType.Dangerous]: { emoji: '😠', displayName: 'Dangerous', textClass: 'text-red-300', barClass: 'bg-red-500' },
};

// --- Briefing Interfaces ---
interface BriefingSource { uri: string; title: string; }
interface WeatherInfo { text: string; icon: string; }
interface LiveBriefing { summary: string; sources: BriefingSource[]; weather?: WeatherInfo; }

// --- Weather Widget Component ---
const WeatherWidget: React.FC<{ weather: WeatherInfo }> = ({ weather }) => {
    const WeatherIcon = useMemo(() => {
        const iconKeyword = weather.icon.toLowerCase();
        if (iconKeyword.includes('sun') || iconKeyword.includes('clear')) return SunIcon;
        if (iconKeyword.includes('cloud')) return CloudIcon;
        if (iconKeyword.includes('rain') || iconKeyword.includes('shower')) return CloudRainIcon;
        if (iconKeyword.includes('storm') || iconKeyword.includes('thunder')) return BoltIcon;
        if (iconKeyword.includes('snow')) return SnowflakeIcon;
        return CloudIcon; // Default icon
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


// --- Modal Components (Defined within the same file) ---

const VibeDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; vibes: Vibe[] }> = ({ isOpen, onClose, vibes }) => {
    if (!isOpen) return null;

    const totalVibes = vibes.length;
    const breakdown = useMemo(() => {
        if (totalVibes === 0) return [];
        const counts = vibes.reduce((acc, vibe) => {
            acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts)
            // FIX: Explicitly cast `count` to a number to satisfy TypeScript's type checker for arithmetic operations.
            .map(([type, count]) => ({ type, percentage: ((count as number) / totalVibes) * 100 }))
            .sort((a, b) => b.percentage - a.percentage);
    }, [vibes, totalVibes]);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Local Vibe Breakdown</h2>
                {totalVibes > 0 ? (
                    <div className="space-y-3">
                        {breakdown.map(({ type, percentage }) => (
                            <div key={type}>
                                <div className="flex justify-between items-center text-sm font-medium mb-1">
                                    <span className={VIBE_CONFIG[type]?.textClass}>{VIBE_CONFIG[type]?.displayName || type}</span>
                                    <span className="text-gray-400">{percentage.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className={`${VIBE_CONFIG[type]?.barClass} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-400">No vibes reported in this area.</p>}
                <button onClick={onClose} className="w-full mt-6 bg-brand-accent text-white font-bold py-2 px-4 rounded-md">Close</button>
            </div>
        </div>
    );
};

const SOSDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; alerts: SOS[] }> = ({ isOpen, onClose, alerts }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Nearby SOS Alerts</h2>
                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                    {alerts.length > 0 ? (
                        alerts.map(sos => <ActivityCard key={sos.id} item={{ ...sos, itemType: 'sos' }} />)
                    ) : <p className="text-gray-400">No SOS alerts reported in this area.</p>}
                </div>
                <button onClick={onClose} className="w-full mt-6 bg-brand-accent text-white font-bold py-2 px-4 rounded-md">Close</button>
            </div>
        </div>
    );
};


// --- Main Activity/Trending Component ---

const Activity: React.FC = () => {
    const { vibes, sos } = useData();
    const [location, setLocation] = useState<Location | null>(null);
    
    // AI Briefing State
    const [briefing, setBriefing] = useState<LiveBriefing | null>(null);
    const [briefingLoading, setBriefingLoading] = useState(true);
    const [briefingError, setBriefingError] = useState<string | null>(null);
    const [showSources, setShowSources] = useState(false);

    // Modal State
    const [isVibeModalOpen, setIsVibeModalOpen] = useState(false);
    const [isSosModalOpen, setIsSosModalOpen] = useState(false);

    useEffect(() => {
        const fetchBriefing = async (loc: Location) => {
            setBriefingLoading(true);
            setBriefingError(null);
            try {
                let city = 'the current city', country = 'country';
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=10`);
                if (geoResponse.ok) {
                    const data = await geoResponse.json();
                    city = data.address.city || data.address.town || data.address.county || 'the area';
                    country = data.address.country || '';
                }

                const apiKey = process.env.API_KEY;
                if (!apiKey) throw new Error("API key not configured.");
                const ai = new GoogleGenAI({ apiKey });
                
                const prompt = `Act as a local safety reporter for ${city}, ${country}. Your first line of response MUST be a weather report prefixed with "WEATHER:". Use one of the following keywords for the condition: 'Sunny', 'Cloudy', 'Rainy', 'Stormy', 'Snowy'. For example: "WEATHER: 15°C, Cloudy". Then, on a new line, provide a concise summary of current events from the last 12 hours that could affect the public atmosphere. Focus on traffic, large crowds, public transit issues, or significant local news. For each news item, you MUST provide the source URL for verification.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { tools: [{ googleSearch: {} }] },
                });
                
                const fullText = response.text;
                const lines = fullText.split('\n');
                let weatherData: WeatherInfo | undefined = undefined;
                let summaryText = fullText;

                if (lines[0].startsWith('WEATHER:')) {
                    const weatherLine = lines[0].replace('WEATHER:', '').trim();
                    const conditionKeyword = ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy'].find(k => weatherLine.toLowerCase().includes(k)) || 'cloudy';
                    weatherData = { text: weatherLine, icon: conditionKeyword };
                    summaryText = lines.slice(1).join('\n').trim();
                }

                const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
                    .map((chunk: any) => chunk.web)
                    .filter((web: any) => web?.uri && web?.title)
                    .reduce((acc: any[], current: any) => { // Deduplicate
                        if (!acc.find(item => item.uri === current.uri)) acc.push(current);
                        return acc;
                    }, []);

                setBriefing({ summary: summaryText, sources, weather: weatherData });

            } catch (err: any) {
                setBriefingError(`Failed to generate briefing: ${err.message}`);
            } finally {
                setBriefingLoading(false);
            }
        };

        navigator.geolocation.getCurrentPosition(
            pos => {
                const userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLocation(userLocation);
                fetchBriefing(userLocation);
            },
            err => {
                console.error("Geolocation error:", err);
                setBriefingError("Could not get your location. Please enable location services.");
                setBriefingLoading(false);
            }
        );
    }, []);

    const nearbyVibes = useMemo(() => {
        if (!location) return [];
        return vibes.filter(v => haversineDistance(location, v.location) <= 1); // 1km radius for local vibe
    }, [location, vibes]);

    const dominantVibe = useMemo(() => {
        if (nearbyVibes.length === 0) return null;
        const counts = nearbyVibes.reduce<Record<string, number>>((acc, vibe) => {
            acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
            return acc;
        }, {});
        const dominantType = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        return { type: dominantType as VibeType, ...VIBE_CONFIG[dominantType] };
    }, [nearbyVibes]);

    const nearbySOS = useMemo(() => {
        if (!location) return [];
        return sos.filter(s => haversineDistance(location, s.location) <= 5); // 5km radius for SOS alerts
    }, [location, sos]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-3xl font-bold">Trending</h1>

            <div className="bg-brand-secondary p-4 rounded-lg space-y-4">
                <h2 className="text-xl font-semibold text-white">Live Community Briefing</h2>
                {briefingLoading ? (
                    <p className="text-gray-400 text-center py-4">Generating your live briefing...</p>
                ) : briefingError ? (
                    <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{briefingError}</p>
                ) : briefing ? (
                    <div className="space-y-4">
                        {briefing.weather && <WeatherWidget weather={briefing.weather} />}
                        
                        <p className="text-gray-300 whitespace-pre-wrap">{briefing.summary}</p>

                         {briefing.sources.length > 0 && (
                            <div className="pt-3 border-t border-gray-700">
                                <button
                                  onClick={() => setShowSources(!showSources)}
                                  className="text-sm font-semibold text-brand-accent hover:text-blue-400"
                                >
                                  {showSources ? 'Hide Sources' : 'Show Sources'}
                                </button>
                                {showSources && (
                                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                                        {briefing.sources.map((source, i) => (
                                            <li key={i}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                                                    {source.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setIsVibeModalOpen(true)} className="bg-brand-secondary p-4 rounded-lg text-center space-y-2 hover:bg-gray-700 transition-colors">
                    <p className="text-sm font-semibold text-gray-400">Dominant Vibe</p>
                    {dominantVibe ? (
                        <div>
                            <p className="text-4xl">{dominantVibe.emoji}</p>
                            <p className={`font-bold ${dominantVibe.textClass}`}>{dominantVibe.displayName}</p>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center">
                            <FireIcon className="w-10 h-10 text-gray-600" />
                            <p className="text-gray-500 text-sm mt-2">No data</p>
                        </div>
                    )}
                </button>
                <button onClick={() => setIsSosModalOpen(true)} className="bg-brand-secondary p-4 rounded-lg text-center space-y-2 hover:bg-gray-700 transition-colors">
                     <p className="text-sm font-semibold text-gray-400">Recent SOS</p>
                     <div className="flex flex-col items-center justify-center">
                        <BellAlertIcon className={`w-10 h-10 ${nearbySOS.length > 0 ? 'text-red-400 animate-pulse' : 'text-gray-600'}`} />
                        <p className="font-bold text-white text-3xl mt-2">{nearbySOS.length}</p>
                     </div>
                </button>
            </div>
            
            <VibeDetailsModal isOpen={isVibeModalOpen} onClose={() => setIsVibeModalOpen(false)} vibes={nearbyVibes} />
            <SOSDetailsModal isOpen={isSosModalOpen} onClose={() => setIsSosModalOpen(false)} alerts={nearbySOS} />
        </div>
    );
};

export default Activity;