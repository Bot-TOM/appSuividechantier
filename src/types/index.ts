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
export type ChantierStatut = 'planifie' | 'en_attente' | 'en_cours' | 'termine' | 'bloque'

export type TypeContrat = 'revente_totale' | 'autoconsommation' | 'autoconsommation_surplus'

export interface Chantier {
  id: string
  nom: string
  client_nom: string
  client_adresse: string
  client_telephone?: string
  type_installation: string
  type_contrat?: TypeContrat | null
  nb_panneaux: number
  puissance_kwc?: number | null
  date_prevue: string
  date_fin_prevue?: string | null
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
  consigne: string | null
  started_at: string | null
  finished_at: string | null
  photo_url: string | null   // legacy — remplacé par etape_photos
  updated_at: string
}

export interface EtapePhoto {
  id: string
  etape_id: string
  chantier_id: string
  url: string
  created_at: string
}

// Notes rapides
export interface Note {
  id: string
  chantier_id: string
  technicien_id: string
  contenu: string
  created_at: string
}

// Auto-contrôle
export interface AutoControleCheck {
  id: string
  categorie: string
  label: string
  checked: boolean
  commentaire: string
}

export interface AutoControle {
  id: string
  chantier_id: string
  technicien_id: string
  checks: AutoControleCheck[]
  commentaire: string | null
  signe_le: string | null
  created_at: string
  updated_at: string
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
  resolved_at?: string | null
}
