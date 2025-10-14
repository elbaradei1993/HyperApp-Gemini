import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { decode, decodeAudioData, encode } from '../../utils/audio';
import { supabase } from '../../services/supabaseClient';
import { AuthContext } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Vibe, VibeType, Location, SOS, Event } from '../../types';
import { haversineDistance } from '../../utils/geolocation';

interface LiveAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TranscriptionEntry {
    speaker: 'user' | 'model';
    text: string;
}

interface LiveSession {
    sendRealtimeInput(input: { media: Blob }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; } }): void;
    close(): void;
}

const LiveAssistantModal: React.FC<LiveAssistantModalProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState('Initializing...');
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    const { vibes, sos, events } = useData();
    const auth = useContext(AuthContext);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;

        animationFrameIdRef.current = requestAnimationFrame(drawWaveform);

        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!canvasCtx || canvas.width === 0 || canvas.height === 0) {
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(13, 17, 23)'; // brand-primary
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 229, 255)'; // brand-accent
        canvasCtx.beginPath();

        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }, []);

    const cleanup = () => {
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
        }
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = null;
        }
        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
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
                
                setStatus('Analyzing Area Data...');
                let vibeContext = 'No recent community vibe data is available for this area.';
                let sosContext = 'No recent SOS alerts have been reported in this area.';
                let eventContext = 'No community events are happening nearby.';
                let initialGreeting = 'Hello! I am your live emergency assistant. How can I help you?';

                if (userLocation) {
                    const userLatLng = { lat: userLocation.latitude, lng: userLocation.longitude };
                    const nearbyVibes = vibes
                        .filter(vibe => haversineDistance(userLatLng, vibe.location) <= 1)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const nearbySOS = sos
                        .filter(s => haversineDistance(userLatLng, s.location) <= 1)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const now = new Date();
                    const nearbyEvents = events
                        .filter(e => {
                            const eventEndDate = e.end_time ? new Date(e.end_time) : new Date(new Date(e.event_time).getTime() + 2 * 60 * 60 * 1000);
                            return eventEndDate >= now && haversineDistance(userLatLng, e.location) <= 1;
                        })
                        .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

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
                    if (nearbySOS.length > 0) {
                        sosContext = `There are ${nearbySOS.length} recent SOS alert(s) nearby. The latest one reports: "${nearbySOS[0].details}".`;
                    }
                    if (nearbyEvents.length > 0) {
                        eventContext = `There is an upcoming community event nearby: "${nearbyEvents[0].title}". This may cause crowds or noise.`;
                    }
                }
                
                setStatus('Connecting...');
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

                setTranscription([{ speaker: 'model', text: initialGreeting }]);
                
                const sendSOSAlertFunctionDeclaration: FunctionDeclaration = {
                    name: 'sendSOSAlert',
                    parameters: {
                        type: Type.OBJECT,
                        description: `Dispatches an SOS alert to the HyperAPP community. This is a critical action for genuine emergencies.
--- CONTEXT ---
- User's Approximate Location: ${userAddress}
- Local Community Vibe: ${vibeContext}
- Nearby SOS Alerts: ${sosContext}
- Nearby Events: ${eventContext}
--- END CONTEXT ---
Use this comprehensive context to inform your decision. Ask clarifying questions before dispatching if the situation is ambiguous.`,
                        properties: {
                            details: { type: Type.STRING, description: 'A brief, clear description of the emergency situation, as stated by the user.' },
                        },
                        required: ['details'],
                    },
                };

                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            setStatus('Live');
                            const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
                            mediaStreamSourceRef.current = source;
                            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = scriptProcessor;

                            const analyser = inputAudioContextRef.current!.createAnalyser();
                            analyser.fftSize = 2048;
                            analyserRef.current = analyser;

                            source.connect(analyser);
                            analyser.connect(scriptProcessor);
                            scriptProcessor.connect(inputAudioContextRef.current!.destination);
                            
                            if (canvasRef.current) {
                                const observer = new ResizeObserver(entries => {
                                    if (entries[0] && entries[0].contentRect.width > 0) {
                                        drawWaveform();
                                        observer.disconnect();
                                        resizeObserverRef.current = null;
                                    }
                                });
                                observer.observe(canvasRef.current);
                                resizeObserverRef.current = observer;
                            }

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
                                            const locationPayload = `SRID=4326;POINT(${position.coords.longitude} ${position.coords.latitude})`;
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
                        tools: [{ functionDeclarations: [sendSOSAlertFunctionDeclaration] }],
                    },
                });

            } catch (err: any) {
                console.error("Failed to start session:", err);
                let friendlyError = `Error: ${err.message}`;
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    friendlyError = 'Error: Microphone permission denied. Please enable it in your browser settings.';
                } else if (err.name === 'NotFoundError') {
                     friendlyError = 'Error: No microphone found. Please connect a microphone and try again.';
                }
                setStatus(friendlyError);
            }
        };

        startSession();

        return () => {
            cleanup();
        };
    }, [isOpen, auth?.user?.id, vibes, sos, events, drawWaveform]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-brand-primary z-[9999] flex flex-col p-4 font-sans">
            <div className="flex justify-between items-center mb-4 text-text-primary">
                <h1 className="text-2xl font-bold">Live Emergency Assistant</h1>
                <div className="flex items-center space-x-2">
                    <span className={`h-3 w-3 rounded-full ${status === 'Live' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    <span className="font-mono text-sm">{status}</span>
                </div>
            </div>
            <div className="flex-grow bg-brand-secondary rounded-lg p-4 overflow-y-auto space-y-4">
                {transcription.map((entry, index) => (
                    <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-brand-accent text-brand-primary font-medium' : 'bg-gray-700 text-text-primary'}`}>
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
            <div className="flex-shrink-0 pt-4 bg-brand-primary">
                 <canvas ref={canvasRef} width="600" height="80" className="w-full h-16 rounded-md bg-brand-primary"></canvas>
                <button
                    onClick={handleClose}
                    className="w-full mt-2 bg-brand-danger text-white font-bold py-3 px-4 rounded-md hover:bg-fuchsia-500 transition-colors"
                >
                    End Session
                </button>
            </div>
        </div>
    );
};

export default LiveAssistantModal;