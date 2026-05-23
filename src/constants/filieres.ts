import type { Filiere, Maillon, LotEventType } from '../types/lotChain';

// ============================================================================
// Filières
// ============================================================================

export interface FiliereConfig {
  id: Filiere;
  label: string;
  shortLabel: string;
  icon: string; // lucide icon name (string pour rester découplé)
  description: string;
  // Maillons typiques de cette filière (premier = source).
  // Sert à filtrer les choix dans onboarding et à proposer le maillon par défaut.
  maillons: Maillon[];
}

export const FILIERES: Record<Filiere, FiliereConfig> = {
  peche: {
    id: 'peche',
    label: 'Pêche maritime',
    shortLabel: 'Pêche',
    icon: 'Fish',
    description: 'Marée, criée, mareyage, poissonnerie',
    maillons: ['pecheur', 'criee', 'mareyeur', 'poissonnier', 'restaurateur', 'logisticien'],
  },
  elevage: {
    id: 'elevage',
    label: 'Élevage',
    shortLabel: 'Élevage',
    icon: 'Beef',
    description: 'Bétail, volaille, ovins, abattage',
    maillons: ['eleveur', 'transformateur', 'charcutier', 'distributeur', 'detaillant', 'restaurateur', 'logisticien'],
  },
  laitier: {
    id: 'laitier',
    label: 'Laitier',
    shortLabel: 'Laitier',
    icon: 'Milk',
    description: 'Lait, crème, yaourt',
    maillons: ['producteur', 'transformateur', 'distributeur', 'cremier', 'restaurateur', 'logisticien'],
  },
  fromage: {
    id: 'fromage',
    label: 'Fromagerie',
    shortLabel: 'Fromage',
    icon: 'Cake',
    description: 'Affineur, crémier, AOP',
    maillons: ['producteur', 'fromager', 'distributeur', 'cremier', 'restaurateur', 'logisticien'],
  },
  charcuterie: {
    id: 'charcuterie',
    label: 'Charcuterie / Boucherie',
    shortLabel: 'Charcuterie',
    icon: 'Drumstick',
    description: 'Boucherie, salaison, traiteur',
    maillons: ['eleveur', 'charcutier', 'transformateur', 'distributeur', 'detaillant', 'restaurateur', 'logisticien'],
  },
  legumes: {
    id: 'legumes',
    label: 'Fruits & Légumes',
    shortLabel: 'Fruits & Légumes',
    icon: 'Apple',
    description: 'Maraîcher, primeur, marché',
    maillons: ['producteur', 'distributeur', 'primeur', 'detaillant', 'restaurateur', 'logisticien'],
  },
  boulangerie: {
    id: 'boulangerie',
    label: 'Boulangerie / Pâtisserie',
    shortLabel: 'Boulangerie',
    icon: 'Croissant',
    description: 'Pain, viennoiserie, biscuiterie',
    maillons: ['producteur', 'boulanger', 'distributeur', 'detaillant', 'restaurateur', 'logisticien'],
  },
  restauration: {
    id: 'restauration',
    label: 'Restauration',
    shortLabel: 'Restauration',
    icon: 'Utensils',
    description: 'Resto, cantine, hôtel-resto, traiteur',
    maillons: ['restaurateur'],
  },
  vins: {
    id: 'vins',
    label: 'Vins & Spiritueux',
    shortLabel: 'Vins',
    icon: 'Wine',
    description: 'Viticulteur, caviste, négoce',
    maillons: ['producteur', 'transformateur', 'distributeur', 'caviste', 'restaurateur', 'logisticien'],
  },
  autre: {
    id: 'autre',
    label: 'Autre filière agroalimentaire',
    shortLabel: 'Autre',
    icon: 'Package',
    description: 'Autre',
    maillons: ['producteur', 'transformateur', 'distributeur', 'detaillant', 'restaurateur', 'logisticien', 'autre'],
  },
};

export const ALL_FILIERES: FiliereConfig[] = Object.values(FILIERES);

// ============================================================================
// Maillons
// ============================================================================

export interface MaillonConfig {
  id: Maillon;
  label: string;
  // Types d'events que ce maillon a le droit de poser sur un lot dont il est
  // le current_holder. Affiché comme boutons dans la vue détail du lot.
  allowedActions: Exclude<LotEventType, 'CREATE'>[];
  // Si true, le maillon peut être la SOURCE d'un lot (event CREATE).
  canCreate: boolean;
  // Modules HACCP utiles pour ce maillon (référence aux écrans tabs existants).
  haccpModules: Array<'temperatures' | 'receptions' | 'nettoyage' | 'cuisson' | 'tracabilite' | 'huiles' | 'nuisibles'>;
}

export const MAILLONS: Record<Maillon, MaillonConfig> = {
  producteur: {
    id: 'producteur',
    label: 'Producteur',
    canCreate: true,
    allowedActions: ['TRANSFER', 'CONTROL', 'DESTROY'],
    haccpModules: ['nettoyage', 'nuisibles'],
  },
  pecheur: {
    id: 'pecheur',
    label: 'Pêcheur',
    canCreate: true,
    allowedActions: ['TRANSFER', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'nettoyage'],
  },
  eleveur: {
    id: 'eleveur',
    label: 'Éleveur',
    canCreate: true,
    allowedActions: ['TRANSFER', 'CONTROL', 'DESTROY'],
    haccpModules: ['nettoyage', 'nuisibles'],
  },
  transformateur: {
    id: 'transformateur',
    label: 'Transformateur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'cuisson', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  criee: {
    id: 'criee',
    label: 'Criée',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'nettoyage'],
  },
  mareyeur: {
    id: 'mareyeur',
    label: 'Mareyeur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  fromager: {
    id: 'fromager',
    label: 'Fromager / Affineur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  charcutier: {
    id: 'charcutier',
    label: 'Charcutier / Boucher',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'cuisson', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  boulanger: {
    id: 'boulanger',
    label: 'Boulanger / Pâtissier',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'cuisson', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  distributeur: {
    id: 'distributeur',
    label: 'Distributeur / Grossiste',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'nuisibles'],
  },
  detaillant: {
    id: 'detaillant',
    label: 'Détaillant',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  poissonnier: {
    id: 'poissonnier',
    label: 'Poissonnier',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  primeur: {
    id: 'primeur',
    label: 'Primeur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  cremier: {
    id: 'cremier',
    label: 'Crémier',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'tracabilite', 'nuisibles'],
  },
  caviste: {
    id: 'caviste',
    label: 'Caviste',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'tracabilite'],
  },
  restaurateur: {
    id: 'restaurateur',
    label: 'Restaurateur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['temperatures', 'receptions', 'nettoyage', 'cuisson', 'tracabilite', 'huiles', 'nuisibles'],
  },
  logisticien: {
    id: 'logisticien',
    label: 'Logisticien / Transporteur',
    canCreate: false,
    allowedActions: ['TRANSFER', 'CONTROL'],
    haccpModules: ['temperatures', 'nettoyage'],
  },
  autre: {
    id: 'autre',
    label: 'Autre',
    canCreate: true,
    allowedActions: ['TRANSFER', 'TRANSFORM', 'CONTROL', 'CONSUME', 'DESTROY'],
    haccpModules: ['nettoyage'],
  },
};

// ============================================================================
// Form schema par (filière, action) — pilote les écrans CREATE/TRANSFORM
// ============================================================================

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  unit?: string;
  help?: string;
}

interface CreateSchema {
  productNameLabel: string;
  productNamePlaceholder: string;
  defaultUnit: string;
  unitOptions: Array<{ value: string; label: string }>;
  fields: FieldDef[];
}

export const CREATE_SCHEMAS: Partial<Record<Filiere, CreateSchema>> = {
  peche: {
    productNameLabel: 'Espèce',
    productNamePlaceholder: 'Thon rouge',
    defaultUnit: 'kg',
    unitOptions: [
      { value: 'kg', label: 'kg' },
      { value: 'piece', label: 'pièce(s)' },
      { value: 'caisse', label: 'caisse(s)' },
    ],
    fields: [
      { key: 'espece', label: 'Espèce (nom scientifique)', type: 'text', placeholder: 'Thunnus thynnus' },
      { key: 'zone_peche', label: 'Zone FAO', type: 'select', required: true, options: [
        { value: 'FAO-21', label: 'FAO 21 — Atlantique NW' },
        { value: 'FAO-27', label: 'FAO 27 — Atlantique NE' },
        { value: 'FAO-31', label: 'FAO 31 — Atlantique central W' },
        { value: 'FAO-34', label: 'FAO 34 — Atlantique central E' },
        { value: 'FAO-37', label: 'FAO 37 — Méditerranée / mer Noire' },
        { value: 'FAO-41', label: 'FAO 41 — Atlantique SW' },
        { value: 'FAO-47', label: 'FAO 47 — Atlantique SE' },
        { value: 'FAO-51', label: 'FAO 51 — Océan Indien W' },
        { value: 'FAO-57', label: 'FAO 57 — Océan Indien E' },
        { value: 'FAO-61', label: 'FAO 61 — Pacifique NW' },
        { value: 'FAO-67', label: 'FAO 67 — Pacifique NE' },
      ] },
      { key: 'methode', label: 'Méthode', type: 'select', options: [
        { value: 'ligne', label: 'Ligne / palangre' },
        { value: 'filet_maillant', label: 'Filet maillant' },
        { value: 'chalut', label: 'Chalut' },
        { value: 'senne', label: 'Senne' },
        { value: 'casier', label: 'Casier' },
        { value: 'plongee', label: 'Plongée' },
      ] },
      { key: 'bateau', label: 'Nom / immatriculation bateau', type: 'text', placeholder: 'F/V Marie-Galante CC-12345' },
      { key: 'date_capture', label: 'Date de capture', type: 'date' },
    ],
  },
  elevage: {
    productNameLabel: 'Animal / lot',
    productNamePlaceholder: 'Veau Charolais',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'pièce(s)' },
      { value: 'kg', label: 'kg (poids vif)' },
    ],
    fields: [
      { key: 'id_animal', label: 'Identifiant animal / lot', type: 'text', placeholder: 'FR-12345-67890' },
      { key: 'race', label: 'Race', type: 'text', placeholder: 'Charolaise' },
      { key: 'troupeau', label: 'Troupeau', type: 'text' },
      { key: 'date_naissance', label: 'Date de naissance', type: 'date' },
      { key: 'date_abattage', label: "Date d'abattage", type: 'date' },
      { key: 'abattoir', label: 'Abattoir (numéro agrément)', type: 'text' },
      { key: 'bio', label: 'Élevage bio', type: 'boolean' },
    ],
  },
  laitier: {
    productNameLabel: 'Produit laitier',
    productNamePlaceholder: 'Lait cru entier',
    defaultUnit: 'L',
    unitOptions: [
      { value: 'L', label: 'litre(s)' },
      { value: 'kg', label: 'kg' },
    ],
    fields: [
      { key: 'type_lait', label: 'Type', type: 'select', required: true, options: [
        { value: 'vache', label: 'Vache' },
        { value: 'chevre', label: 'Chèvre' },
        { value: 'brebis', label: 'Brebis' },
        { value: 'bufflonne', label: 'Bufflonne' },
        { value: 'melange', label: 'Mélange' },
      ] },
      { key: 'date_traite', label: 'Date de traite', type: 'date' },
      { key: 'volume_litres', label: 'Volume', type: 'number', unit: 'L' },
      { key: 'ferme', label: 'Ferme / GAEC', type: 'text' },
      { key: 'bio', label: 'Lait bio', type: 'boolean' },
    ],
  },
  fromage: {
    productNameLabel: 'Fromage',
    productNamePlaceholder: 'Comté 18 mois',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'meule(s)' },
      { value: 'kg', label: 'kg' },
    ],
    fields: [
      { key: 'recette', label: 'Recette / appellation', type: 'text', placeholder: 'Comté AOP' },
      { key: 'duree_affinage_mois', label: 'Affinage', type: 'number', unit: 'mois' },
      { key: 'date_caillage', label: 'Date caillage', type: 'date' },
      { key: 'aop', label: 'AOP / IGP', type: 'text' },
    ],
  },
  charcuterie: {
    productNameLabel: 'Produit',
    productNamePlaceholder: 'Saucisson sec',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'pièce(s)' },
      { value: 'kg', label: 'kg' },
    ],
    fields: [
      { key: 'recette', label: 'Recette / type', type: 'text' },
      { key: 'duree_seche_jours', label: 'Séchage', type: 'number', unit: 'jours' },
      { key: 'origine_viande', label: 'Origine viande', type: 'text', placeholder: 'France' },
    ],
  },
  legumes: {
    productNameLabel: 'Produit',
    productNamePlaceholder: 'Tomates Cœur de bœuf',
    defaultUnit: 'kg',
    unitOptions: [
      { value: 'kg', label: 'kg' },
      { value: 'cagette', label: 'cagette(s)' },
      { value: 'piece', label: 'pièce(s)' },
    ],
    fields: [
      { key: 'variete', label: 'Variété', type: 'text', placeholder: 'Cœur de bœuf' },
      { key: 'date_recolte', label: 'Date de récolte', type: 'date' },
      { key: 'parcelle', label: 'Parcelle', type: 'text' },
      { key: 'bio', label: 'Bio', type: 'boolean' },
    ],
  },
  boulangerie: {
    productNameLabel: 'Produit',
    productNamePlaceholder: 'Baguette tradition',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'pièce(s)' },
      { value: 'kg', label: 'kg' },
    ],
    fields: [
      { key: 'type_produit', label: 'Type', type: 'select', options: [
        { value: 'pain', label: 'Pain' },
        { value: 'viennoiserie', label: 'Viennoiserie' },
        { value: 'patisserie', label: 'Pâtisserie' },
        { value: 'biscuiterie', label: 'Biscuiterie' },
      ] },
      { key: 'date_fournee', label: 'Date de fournée', type: 'date' },
      { key: 'allergenes', label: 'Allergènes (séparés par ,)', type: 'text', placeholder: 'gluten, oeuf, lait' },
    ],
  },
  restauration: {
    productNameLabel: 'Plat / produit',
    productNamePlaceholder: 'Tartare de thon',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'portion(s)' },
      { value: 'kg', label: 'kg' },
    ],
    fields: [
      { key: 'recette', label: 'Recette', type: 'text' },
      { key: 'service', label: 'Service', type: 'select', options: [
        { value: 'midi', label: 'Service midi' },
        { value: 'soir', label: 'Service soir' },
        { value: 'continu', label: 'Continu' },
      ] },
    ],
  },
  vins: {
    productNameLabel: 'Cuvée',
    productNamePlaceholder: 'Côtes du Rhône 2023',
    defaultUnit: 'piece',
    unitOptions: [
      { value: 'piece', label: 'bouteille(s)' },
      { value: 'L', label: 'litre(s)' },
      { value: 'caisse', label: 'caisse(s)' },
    ],
    fields: [
      { key: 'cepage', label: 'Cépage(s)', type: 'text', placeholder: 'Grenache, Syrah' },
      { key: 'millesime', label: 'Millésime', type: 'number' },
      { key: 'appellation', label: 'Appellation', type: 'text', placeholder: 'Côtes du Rhône AOC' },
      { key: 'domaine', label: 'Domaine', type: 'text' },
      { key: 'bio', label: 'Bio / biodynamie', type: 'boolean' },
    ],
  },
  autre: {
    productNameLabel: 'Produit',
    productNamePlaceholder: 'Nom du produit',
    defaultUnit: 'kg',
    unitOptions: [
      { value: 'kg', label: 'kg' },
      { value: 'piece', label: 'pièce(s)' },
      { value: 'L', label: 'litre(s)' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
};

// Champs d'un TRANSFORM (générique, valable pour toutes filières).
export const TRANSFORM_FIELDS: FieldDef[] = [
  { key: 'recette', label: 'Recette / process', type: 'text', placeholder: 'Filetage, désossage, cuisson, mélange...' },
  { key: 'duree_min', label: 'Durée', type: 'number', unit: 'min' },
  { key: 'temperature_celsius', label: 'Température cible', type: 'number', unit: '°C' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

// Champs d'un TRANSFER (handoff entre maillons).
export const TRANSFER_FIELDS: FieldDef[] = [
  { key: 'temperature_transport', label: 'Température transport', type: 'number', unit: '°C' },
  { key: 'duree_transport_min', label: 'Durée transport', type: 'number', unit: 'min' },
  { key: 'transporteur', label: 'Transporteur', type: 'text', placeholder: 'Nom transporteur' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

// Champs d'un CONTROL.
export const CONTROL_FIELDS: FieldDef[] = [
  { key: 'control_type', label: 'Type de contrôle', type: 'select', required: true, options: [
    { value: 'temperature', label: 'Température' },
    { value: 'dlc', label: 'DLC / DDM' },
    { value: 'nettoyage', label: 'Nettoyage' },
    { value: 'tpm', label: 'TPM (huiles)' },
    { value: 'nuisibles', label: 'Nuisibles' },
    { value: 'visuel', label: 'Contrôle visuel' },
    { value: 'autre', label: 'Autre' },
  ] },
  { key: 'value', label: 'Valeur mesurée', type: 'text', placeholder: '4 °C, 2026-12-31, etc.' },
  { key: 'compliant', label: 'Conforme', type: 'boolean' },
  { key: 'notes', label: 'Observations', type: 'textarea' },
];

export const DESTROY_FIELDS: FieldDef[] = [
  { key: 'reason', label: 'Motif', type: 'select', required: true, options: [
    { value: 'perime', label: 'Périmé (DLC dépassée)' },
    { value: 'casse', label: 'Casse / chute' },
    { value: 'refus', label: 'Refus à la réception' },
    { value: 'non_conforme', label: 'Non-conformité (T°, visuel, ...)' },
    { value: 'autre', label: 'Autre' },
  ] },
  { key: 'notes', label: 'Détails', type: 'textarea' },
];

export const CONSUME_FIELDS: FieldDef[] = [
  { key: 'context', label: 'Contexte', type: 'text', placeholder: 'Service midi, plat du jour, ...' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Mapping legacy entre l'ancien `establishment_type` (resto-centré) et
 * (filière, maillon) — utilisé tant que l'onboarding adaptatif n'est pas
 * livré (Phase 3). Permet aux comptes existants de bénéficier des écrans
 * lot/* sans reprovisionnement.
 */
export function legacyEstablishmentTypeToFiliereMaillon(
  type: string
): { filiere: Filiere; maillon: Maillon } {
  switch (type) {
    case 'boulangerie':
      return { filiere: 'boulangerie', maillon: 'boulanger' };
    case 'traiteur':
      return { filiere: 'charcuterie', maillon: 'charcutier' };
    case 'epicerie':
      return { filiere: 'legumes', maillon: 'detaillant' };
    case 'food_truck':
    case 'cantine':
    case 'hotel_restaurant':
    case 'restaurant':
      return { filiere: 'restauration', maillon: 'restaurateur' };
    default:
      return { filiere: 'autre', maillon: 'autre' };
  }
}
