// Rôles utilisateurs
export type UserRole = 'manager' | 'technicien'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  poste?: string | null
  created_at: string
  avatar_url?: string | null
}

// Clés de permissions gérables par le manager
export type PermissionKey =
  | 'voir_tous_chantiers'
  | 'creer_chantier'
  | 'modifier_chantier'
  | 'assigner_techniciens'
  | 'resoudre_anomalie'
  | 'ajouter_document'
  | 'supprimer_message_autres'
  | 'voir_rapports'
  | 'exporter_pdf'

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  voir_tous_chantiers:      'Voir tous les chantiers',
  creer_chantier:           'Créer un chantier',
  modifier_chantier:        'Modifier infos & statut',
  assigner_techniciens:     'Assigner des techniciens',
  resoudre_anomalie:        'Résoudre une anomalie',
  ajouter_document:         'Ajouter un document',
  supprimer_message_autres: 'Supprimer les messages des autres',
  voir_rapports:            'Voir les rapports & stats',
  exporter_pdf:             'Exporter en PDF',
}

// Liste des postes disponibles
export const POSTES_OPTIONS = [
  'Technicien',
  "Chef d'équipe",
  'Chef de chantier',
  'Conducteur de travaux',
] as const

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

// Chat
export type MessageFileType = 'image' | 'document' | 'audio'

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface MessageRead {
  message_id: string
  user_id: string
  read_at: string
  profiles: { full_name: string } | null
}

export interface ChatMessage {
  id: string
  chantier_id: string
  user_id: string
  content: string | null
  file_url: string | null
  file_name: string | null
  file_type: MessageFileType | null
  reply_to_id: string | null
  edited_at: string | null
  created_at: string
  profiles: { full_name: string; avatar_url?: string | null; poste?: string | null; role?: string | null } | null
  message_reactions: MessageReaction[]
  message_reads: MessageRead[]
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
