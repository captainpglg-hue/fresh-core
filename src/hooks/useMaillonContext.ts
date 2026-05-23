import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { MAILLONS, FILIERES, legacyEstablishmentTypeToFiliereMaillon } from '../constants/filieres';
import type { Filiere, Maillon } from '../types/lotChain';
import type { MaillonConfig, FiliereConfig } from '../constants/filieres';

interface MaillonContext {
  filiere: Filiere;
  maillon: Maillon;
  filiereConfig: FiliereConfig;
  maillonConfig: MaillonConfig;
}

/**
 * Renvoie la filière + maillon de l'utilisateur courant. Source de vérité :
 * `establishment.filiere` / `profile.maillon` (Phase 3 — quand l'onboarding
 * les enregistrera). En attendant, fallback sur le mapping legacy depuis
 * `establishment_type` pour que les comptes existants (mode démo restau,
 * inscriptions antérieures à la Phase 3) bénéficient des écrans lot/*.
 */
export function useMaillonContext(): MaillonContext {
  const { user, establishment } = useAuthStore();

  return useMemo(() => {
    const profileMaillon = (user as unknown as { maillon?: Maillon } | null)?.maillon;
    const establishmentFiliere = (establishment as unknown as { filiere?: Filiere } | null)?.filiere;

    const fallback = legacyEstablishmentTypeToFiliereMaillon(
      establishment?.establishment_type ?? 'restaurant'
    );

    const filiere: Filiere = establishmentFiliere ?? fallback.filiere;
    const maillon: Maillon = profileMaillon ?? fallback.maillon;

    return {
      filiere,
      maillon,
      filiereConfig: FILIERES[filiere],
      maillonConfig: MAILLONS[maillon],
    };
  }, [user, establishment]);
}
