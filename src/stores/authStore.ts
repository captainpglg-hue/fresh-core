import { create } from 'zustand';
import { supabase, isDemoMode } from '../services/supabase';
import type { Profile, Establishment } from '../types/database';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  user: Profile | null;
  session: Session | null;
  establishment: Establishment | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setEstablishment: (establishment: Establishment | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  establishment: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      if (isDemoMode) {
        // Mode demo : utilisateur fictif, pas besoin de Supabase
        const demoUser: Profile = {
          id: 'demo-user-001',
          email: 'demo@freshcore.io',
          full_name: 'Marie Dupont',
          role: 'owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const demoEstablishment: Establishment = {
          id: 'demo-establishment-001',
          owner_id: 'demo-user-001',
          name: 'Restaurant Le Provencal',
          address: '12 rue de la Paix',
          city: 'Paris',
          postal_code: '75002',
          siret: '12345678901234',
          establishment_type: 'restaurant',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set({
          user: demoUser,
          establishment: demoEstablishment,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const { data: establishment } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_id', session.user.id)
          .single();

        set({
          session,
          user: profile || null,
          establishment: establishment || null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          set({ session, user: profile || null, isAuthenticated: true });
        } else {
          set({ session: null, user: null, establishment: null, isAuthenticated: false });
        }
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: 'owner',
      });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, establishment: null, isAuthenticated: false });
  },

  setEstablishment: (establishment) => set({ establishment }),
}));
