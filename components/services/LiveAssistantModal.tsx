import React, { useState, useEffect, useRef, useContext } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type, LiveSession } from '@google/genai';
import { decode, decodeAudioData, encode } from '../../utils/audio';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { Vibe, VibeType, Location } from '../../types';
import { haversineDistance } from '../../utils/geolocation';

interface LiveAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TranscriptionEntry {
    speaker: 'user' | 'model';
    text: string;
}

// Helper to convert Supabase GeoJSON point to our LatLng format
const parseLocation = (loc: any): Location | null => {
    if (loc && loc.coordinates && loc.coordinates.length === 2) {
        return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
    }
    return null;
}

const LiveAssistantModal: React.FC<LiveAssistantModalProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState('Initializing...');
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    const auth = useContext(AuthContext);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext>();
    const outputAudioContextRef = useRef<AudioContext>();
    const scriptProcessorRef = useRef<ScriptProcessorNode>();
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode>();
    const streamRef = useRef<MediaStream>();
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    
    // Using refs for transcription parts to avoid stale state in callbacks
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const sendSOSAlertFunctionDeclaration: FunctionDeclaration = {
        name: 'sendSOSAlert',
        parameters: {
            type: Type.OBJECT,
            description: 'Dispatches an SOS alert to the HyperAPP community with the user location and a brief description of the emergency.',
            properties: {
                details: { type: Type.STRING, description: 'A brief, clear description of the emergency situation.' },
            },
            required: ['details'],
        },
    };

    const cleanup = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = undefined;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = undefined;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = undefined;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }

        sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
        
        for (const source of outputSourcesRef.current.values()) {
            try { source.stop(); } catch(e) { /* ignore */ }
        }
        outputSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setTranscription([]);
        setStatus('Initializing...');
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
    };

    const handleClose = () => {
        cleanup();
        onClose();
    };
    
    useEffect(() => {
        if (!isOpen) {
            cleanup();
            return;
        }

        const startSession = async () => {
            try {
                let apiKey: string | undefined;
                try { apiKey = process.env.API_KEY; } catch (e) { /* ignore */ }
                if (!apiKey) {
                    setStatus('Error: API key not configured.');
                    return;
                }
                const ai = new GoogleGenAI({ apiKey });
                
                setStatus('Requesting Permissions...');
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

                setStatus('Getting Location...');
                let userAddress = 'an unknown location';
                let userLocation: { latitude: number, longitude: number } | null = null;
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                    const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.latitude}&lon=${userLocation.longitude}`);
                    if (geoResponse.ok) {
                        const geoData = await geoResponse.json();
                        userAddress = geoData.display_name || 'an address that could not be determined';
                    }
                } catch (locationError: any) {
                    console.warn("Could not get user's location for AI context:", locationError.message);
                }
                
                setStatus('Analyzing Vibe Data...');
                let vibeContext = 'No recent community vibe data is available for this area.';
                let initialGreeting = 'Hello! I am your live emergency assistant. How can I help you?';

                if (userLocation) {
                    const { data: allVibes, error: vibesError } = await supabase.from('vibes').select('*');

                    if (vibesError) {
                        console.warn("Could not fetch nearby vibes for AI context:", vibesError.message);
                    } else if (allVibes && allVibes.length > 0) {
                        const parsedVibes = (allVibes as any[]).map(v => ({...v, location: parseLocation(v.location)}));
                        const nearbyVibes = parsedVibes.filter(vibe => 
                            vibe.location && haversineDistance({ lat: userLocation!.latitude, lng: userLocation!.longitude }, vibe.location) <= 1
                        ) as Vibe[];

                        if (nearbyVibes.length > 0) {
                             const vibeDisplayNameMapping: Record<string, string> = {
                                [VibeType.Safe]: 'Safe', [VibeType.Calm]: 'Calm', [VibeType.Noisy]: 'Noisy', [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly', [VibeType.Suspicious]: 'Suspicious', [VibeType.Dangerous]: 'Dangerous',
                            };
                            
                            const vibeCounts = nearbyVibes.reduce((acc: any, vibe: Vibe) => {
                                acc[vibe.vibe_type] = (acc[vibe.vibe_type] || 0) + 1;
                                return acc;
                            }, {});
                            const totalVibes = nearbyVibes.length;
                            const dominantVibe = Object.keys(vibeCounts).reduce((a, b) => vibeCounts[a] > vibeCounts[b] ? a : b);
                            const dominantVibeName = vibeDisplayNameMapping[dominantVibe] || dominantVibe;

                            initialGreeting = `Hello! I am your live emergency assistant. The current vibe in your area is reported as "${dominantVibeName}". How can I help you?`;
                            
                            const breakdownText = Object.entries(vibeCounts)
                                .map(([type, count]) => `${(((count as number) / totalVibes) * 100).toFixed(0)}% ${vibeDisplayNameMapping[type] || type}`)
                                .join(', ');

                            vibeContext = `The area has ${totalVibes} recent report(s). Breakdown: ${breakdownText}.`;
                        }
                    }
                }
                
                setStatus('Connecting...');
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

                setTranscription([{ speaker: 'model', text: initialGreeting }]);
                
                const systemInstruction = `You are a calm, helpful, and concise emergency assistant for the HyperAPP community safety app. You have access to real-time community data.

--- CONTEXT ---
- User's Approximate Location: ${userAddress}
- Local Community Vibe: ${vibeContext}
--- END CONTEXT ---

Your primary goal is to assess the user's situation and, if necessary, dispatch help using the 'sendSOSAlert' function. Use the location and vibe context to provide more specific guidance and ask relevant questions. For example, if the area is reported as 'Suspicious', you can ask what is making them feel that way. Only use the 'sendSOSAlert' function if you believe there is a genuine emergency that requires intervention.`;

                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            setStatus('Live');
                            const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
                            mediaStreamSourceRef.current = source;
                            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = scriptProcessor;

                            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                const pcmBlob: Blob = {
                                    data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                    mimeType: 'audio/pcm;rate=16000',
                                };
                                sessionPromiseRef.current?.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            };
                            source.connect(scriptProcessor);
                            scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                           if (message.serverContent?.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }
                            if (message.serverContent?.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }

                            if (message.serverContent?.turnComplete) {
                                const finalInput = currentInputTranscriptionRef.current.trim();
                                const finalOutput = currentOutputTranscriptionRef.current.trim();
                                
                                setTranscription(prev => {
                                    const newHistory = [...prev];
                                    if (finalInput) newHistory.push({ speaker: 'user', text: finalInput });
                                    if (finalOutput) newHistory.push({ speaker: 'model', text: finalOutput });
                                    return newHistory;
                                });

                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                            }

                            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                            if (base64EncodedAudioString && outputAudioContextRef.current) {
                                const now = outputAudioContextRef.current.currentTime;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                                const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContextRef.current, 24000, 1);
                                const source = outputAudioContextRef.current.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputAudioContextRef.current.destination);
                                source.addEventListener('ended', () => outputSourcesRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                outputSourcesRef.current.add(source);
                            }

                            if (message.serverContent?.interrupted) {
                                for (const source of outputSourcesRef.current.values()) {
                                    try { source.stop(); } catch(e) { /* ignore */ }
                                    outputSourcesRef.current.delete(source);
                                }
                                nextStartTimeRef.current = 0;
                            }
                            
                            if (message.toolCall) {
                                for (const fc of message.toolCall.functionCalls) {
                                    if (fc.name === 'sendSOSAlert') {
                                        navigator.geolocation.getCurrentPosition(async (position) => {
                                            const locationPayload = `POINT(${position.coords.longitude} ${position.coords.latitude})`;
                                            const { error } = await supabase.from('sos').insert({
                                                user_id: auth?.user?.id,
                                                details: fc.args.details || 'SOS Alert Activated via Live Assistant',
                                                location: locationPayload
                                            });
                                            const result = error ? `Failed: ${error.message}` : "SOS alert sent successfully.";
                                            sessionPromiseRef.current?.then((session) => {
                                                session.sendToolResponse({
                                                    functionResponses: { id: fc.id, name: fc.name, response: { result: result } }
                                                });
                                            });
                                        }, (geoError) => {
                                            const result = `Failed to get location: ${geoError.message}`;
                                            sessionPromiseRef.current?.then((session) => {
                                                session.sendToolResponse({
                                                    functionResponses: { id: fc.id, name: fc.name, response: { result: result } }
                                                });
                                            });
                                        });
                                    }
                                }
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                            console.error('Session error:', e);
                            setStatus(`Error: ${e.message}`);
                        },
                        onclose: (e: CloseEvent) => {
                            setStatus('Connection closed.');
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                        systemInstruction,
                        tools: [{ functionDeclarations: [sendSOSAlertFunctionDeclaration] }],
                    },
                });

            } catch (err: any) {
                console.error("Failed to start session:", err);
                setStatus(`Error: ${err.message}`);
                if (err.name === 'NotAllowedError') {
                    setStatus('Error: Microphone permission denied.');
                }
            }
        };

        startSession();

        return () => {
            cleanup();
        };
    }, [isOpen, auth?.user?.id]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-brand-primary z-[9999] flex flex-col p-4 font-sans">
            <div className="flex justify-between items-center mb-4 text-white">
                <h1 className="text-2xl font-bold">Live Emergency Assistant</h1>
                <div className="flex items-center space-x-2">
                    <span className={`h-3 w-3 rounded-full ${status === 'Live' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    <span className="font-mono text-sm">{status}</span>
                </div>
            </div>
            <div className="flex-grow bg-brand-secondary rounded-lg p-4 overflow-y-auto space-y-4">
                {transcription.map((entry, index) => (
                    <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-brand-accent text-white' : 'bg-gray-600 text-white'}`}>
                            <p className="whitespace-pre-wrap">{entry.text}</p>
                        </div>
                    </div>
                ))}
                 {status !== 'Live' && status.startsWith('Error:') && (
                    <div className="flex justify-center">
                        <div className="max-w-md p-3 rounded-lg bg-red-900/50 text-red-200">
                           <p className="font-bold">Session Failed</p>
                           <p className="text-sm">{status}</p>
                           <p className="text-sm mt-2">Please check your microphone permissions and try again.</p>
                        </div>
                    </div>
                 )}
            </div>
            <button
                onClick={handleClose}
                className="w-full mt-4 bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 transition-colors"
            >
                End Session
            </button>
        </div>
    );
};

export default LiveAssistantModal;