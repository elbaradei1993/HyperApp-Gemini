import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Vibe } from '../types';
import { VibeType } from '../types';

const vibeDisplayNameMapping: Record<string, string> = {
    [VibeType.Safe]: 'Safe',
    [VibeType.Calm]: 'Calm',
    [VibeType.Noisy]: 'Noisy',
    [VibeType.LGBTQIAFriendly]: 'LGBTQIA+ Friendly',
    [VibeType.Suspicious]: 'Suspicious',
    [VibeType.Dangerous]: 'Dangerous',
};

const Trending: React.FC = () => {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvotingIds, setUpvotingIds] = useState<Set<number>>(new Set());

  const fetchTrendingVibes = useCallback(async () => {
    const { data, error } = await supabase
      .from('vibes')
      .select('*, profiles(username)')
      .order('upvotes', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error fetching trending vibes:', error.message);
    } else {
      setVibes(data as Vibe[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTrendingVibes();
    
    const channel = supabase.channel('trending-vibes-realtime')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'vibes' }, 
        (payload) => {
            setVibes(currentVibes => 
                currentVibes.map(vibe => 
                    vibe.id === payload.new.id ? { ...vibe, upvotes: payload.new.upvotes } : vibe
                ).sort((a, b) => b.upvotes - a.upvotes)
            );
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'vibes' },
        fetchTrendingVibes // A new vibe could be a trending one, refetch list
      )
      .subscribe();
    
    return () => {
        supabase.removeChannel(channel);
    }
  }, [fetchTrendingVibes]);

  const upvoteVibe = async (vibeId: number) => {
    if (upvotingIds.has(vibeId)) return;

    setUpvotingIds(prev => new Set(prev).add(vibeId));

    // Optimistic update
    setVibes(currentVibes =>
      currentVibes.map(v =>
        v.id === vibeId ? { ...v, upvotes: v.upvotes + 1 } : v
      ).sort((a,b) => b.upvotes - a.upvotes)
    );

    const { error } = await supabase.rpc('increment_upvotes', { vibe_id: vibeId });
    
    if (error) {
      console.error("Upvote error:", error.message);
      alert(`Failed to upvote: ${error.message}`);
      // Revert on error
      setVibes(currentVibes =>
        currentVibes.map(v =>
          v.id === vibeId ? { ...v, upvotes: v.upvotes - 1 } : v
        ).sort((a,b) => b.upvotes - a.upvotes)
      );
    }

    setUpvotingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(vibeId);
      return newSet;
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Trending Vibes</h1>
      {loading && <p>Loading trending vibes...</p>}
      {!loading && vibes.length === 0 && (
        <div className="text-center py-10 bg-brand-secondary rounded-lg">
          <p className="text-gray-400">No trending vibes right now.</p>
          <p className="text-sm text-gray-500">Be the first to report a vibe!</p>
        </div>
      )}
      <div className="space-y-4">
        {vibes.map((vibe, index) => (
          <div key={vibe.id} className="bg-brand-secondary p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center space-x-4">
                <span className="text-xl font-bold text-gray-500 w-6 text-center">{index + 1}</span>
                <div>
                    <p className="font-bold">{vibeDisplayNameMapping[vibe.vibe_type] || vibe.vibe_type}</p>
                    <p className="text-sm text-gray-400">Reported by {vibe.profiles?.username || 'anonymous'}</p>
                </div>
            </div>
            <button 
              onClick={() => upvoteVibe(vibe.id)}
              disabled={upvotingIds.has(vibe.id)}
              className="bg-brand-accent/30 text-brand-accent font-bold py-2 px-4 rounded-full flex items-center space-x-2 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait"
            >
              <span>👍</span>
              <span>{vibe.upvotes}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Trending;