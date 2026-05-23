import { create } from 'zustand';
import { supabase, isDemoMode } from '../services/supabase';
import { getDatabase } from '../services/database';
import type { Profile, Establishment } from '../types/database';
import type { Filiere, Maillon } from '../types/lotChain';
import type { Session } from '@supabase/supabase-js';

// Profile/Establishment portent désormais filière + maillon depuis la
// migration 003. On étend les types locaux ici (les types base sont mis
// à jour séparément quand on touche le schéma).
export type ProfileWithMaillon = Profile & { maillon?: Maillon };
export type EstablishmentWithFiliere = Establishment & { filiere?: Filiere };

interface AuthState {
  user: ProfileWithMaillon | null;
  session: Session | null;
  establishment: EstablishmentWithFiliere | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setEstablishment: (establishment: EstablishmentWithFiliere | null) => void;
  setFiliereMaillon: (filiere: Filiere, maillon: Maillon) => Promise<void>;
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

  setFiliereMaillon: async (filiere: Filiere, maillon: Maillon) => {
    const state = get();
    const user = state.user;
    const establishment = state.establishment;
    if (!user || !establishment) return;

    // Met à jour le state mémoire immédiatement (réactivité UI).
    set({
      user: { ...user, maillon },
      establishment: { ...establishment, filiere },
    });

    // Persistance locale SQLite (offline-first).
    try {
      const db = await getDatabase();
      await db.runAsync(`UPDATE profiles SET maillon = ? WHERE id = ?`, [maillon, user.id]);
      await db.runAsync(`UPDATE establishments SET filiere = ? WHERE id = ?`, [filiere, establishment.id]);
    } catch {
      // SQLite peut ne pas avoir la colonne sur d'anciennes installs : ignore,
      // la prochaine init la créera (CREATE TABLE IF NOT EXISTS avec defaults).
    }

    // Si Supabase configuré, miroir distant (sinon mode démo, c'est OK).
    if (!isDemoMode) {
      try {
        await supabase.from('profiles').update({ maillon }).eq('id', user.id);
        await supabase.from('establishments').update({ filiere }).eq('id', establishment.id);
      } catch {
        // Failure réseau → SQLite a déjà le bon état, sync_queue rattrapera.
      }
    }
  },
}));
