// Rôles utilisateurs
export type UserRole = 'manager' | 'technicien'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

// Statuts possibles d'un chantier
export type ChantierStatut = 'en_attente' | 'en_cours' | 'termine' | 'bloque'

export interface Chantier {
  id: string
  nom: string
  client_nom: string
  client_adresse: string
  client_telephone?: string
  type_installation: string
  nb_panneaux: number
  date_prevue: string
  statut: ChantierStatut
  created_at: string
  updated_at: string
}

// Liaison chantier ↔ technicien
export interface ChantierTechnicien {
  chantier_id: string
  technicien_id: string
}

// Étapes de suivi terrain
export type EtapeStatut = 'non_fait' | 'en_cours' | 'fait'

export interface Etape {
  id: string
  chantier_id: string
  nom: string
  ordre: number
  statut: EtapeStatut
  consigne: string | null    // note libre du manager (instruction, contexte, durée indicative…)
  started_at: string | null  // horodatage début (technicien)
  finished_at: string | null // horodatage fin (technicien)
  photo_url: string | null   // photo terrain
  updated_at: string
}

// Notes rapides
export interface Note {
  id: string
  chantier_id: string
  technicien_id: string
  contenu: string
  created_at: string
}

// Anomalies
export type AnomalieGravite = 'haute' | 'moyenne' | 'basse'
export type AnomalieStatut = 'ouvert' | 'en_cours' | 'resolu'

export interface Anomalie {
  id: string
  chantier_id: string
  technicien_id: string
  type: string
  description: string
  gravite: AnomalieGravite
  statut: AnomalieStatut
  photo_url?: string
  created_at: string
  updated_at: string
}
