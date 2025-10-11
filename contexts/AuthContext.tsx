import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This function ensures a user profile exists in the public.profiles table.
    const manageUserProfile = async (user: User | null) => {
      if (!user) return;

      // Check if a profile already exists for the user.
      const { data: profile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // 'PGRST116' is the code for 'Exact one row not found', which is expected if the profile is missing.
      // We only want to log other, unexpected errors.
      if (selectError && selectError.code !== 'PGRST116') {
        console.error("Error checking for profile:", selectError.message);
        return;
      }

      // If no profile exists, create one. This retroactively fixes accounts
      // for users who signed up before the database trigger was in place.
      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          username: user.email, // Defaults username to their email. Can be changed in Account page.
        });

        if (insertError) {
          console.error('Error creating user profile:', insertError.message);
        }
      }
    };

    // The onAuthStateChange listener is the single source of truth for auth state.
    // It fires once on initial load with the current session, and then again
    // whenever the auth state changes (e.g., login, logout).
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setSession(session);
        setUser(currentUser);
        if (currentUser) {
          // Ensure profile exists before we stop loading
          await manageUserProfile(currentUser);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};