import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AutoControle, AutoControleCheck } from '@/types'

// ─── Nouvelle fiche PVB102566 — 56 points, 8 sections ────────────────────────
export const CHECKS_DEFAUT: Omit<AutoControleCheck, 'result' | 'commentaire'>[] = [
  // 1. Pose de la structure
  { id: '1_1',  num: '1.1',  categorie: '1 - Pose de la structure',       label: 'Calepinage',                                     exigence: 'Conforme aux plans de calepinage' },
  { id: '1_2',  num: '1.2',  categorie: '1 - Pose de la structure',       label: 'Positionnement des joints de dilatation',        exigence: 'Conforme aux plans de calepinage' },
  { id: '1_3',  num: '1.3',  categorie: '1 - Pose de la structure',       label: 'Couple de serrage',                              exigence: "Conforme à la notice d'installation" },

  // 2. Pose des modules
  { id: '2_1',  num: '2.1',  categorie: '2 - Pose des modules',           label: 'Pinces de fixation des modules',                 exigence: "Présence de l'ensemble des éléments de fixation" },
  { id: '2_2',  num: '2.2',  categorie: '2 - Pose des modules',           label: 'Serrage des étriers',                            exigence: 'Sans déformation des pinces' },
  { id: '2_3',  num: '2.3',  categorie: '2 - Pose des modules',           label: 'Serrage des étriers',                            exigence: 'Modules en contact des pinces' },
  { id: '2_4',  num: '2.4',  categorie: '2 - Pose des modules',           label: 'Mise à la terre',                                exigence: 'Les éléments conducteurs connectés à la même prise de terre' },
  { id: '2_5',  num: '2.5',  categorie: '2 - Pose des modules',           label: 'Câble malt',                                     exigence: 'Section conforme au synoptique' },

  // 3. Connection des modules
  { id: '3_1',  num: '3.1',  categorie: '3 - Connection des modules',     label: 'Connecteurs',                                    exigence: 'Connecteurs bien sertis' },
  { id: '3_2',  num: '3.2',  categorie: '3 - Connection des modules',     label: 'Câbles',                                         exigence: 'Câbles fixés sous les modules' },
  { id: '3_3',  num: '3.3',  categorie: '3 - Connection des modules',     label: 'Implantation',                                   exigence: 'Conforme aux plans' },

  // 4. Câblage en toiture
  { id: '4_1',  num: '4.1',  categorie: '4 - Câblage en toiture',        label: 'Fixation régulières',                            exigence: 'Câbles fixés aux modules ou à la structure (clip bord de tôles)' },
  { id: '4_2',  num: '4.2',  categorie: '4 - Câblage en toiture',        label: 'Câblage des chaînes',                            exigence: 'Conforme aux plans' },
  { id: '4_3',  num: '4.3',  categorie: '4 - Câblage en toiture',        label: 'Câblage des chaînes',                            exigence: 'Marquage "câbles courant continu générateur PV"' },
  { id: '4_4',  num: '4.4',  categorie: '4 - Câblage en toiture',        label: 'Connecteurs / rallonges',                        exigence: 'Sertissage / emboîtement' },
  { id: '4_5',  num: '4.5',  categorie: '4 - Câblage en toiture',        label: 'Chemin de câbles / Propreté',                    exigence: 'Câbles peignés' },
  { id: '4_6',  num: '4.6',  categorie: '4 - Câblage en toiture',        label: 'Chemin de câbles / Propreté',                    exigence: 'Mise à la terre' },
  { id: '4_7',  num: '4.7',  categorie: '4 - Câblage en toiture',        label: 'Chemin de câbles / Propreté',                    exigence: 'Capots tenus par cerclage / clip' },
  { id: '4_8',  num: '4.8',  categorie: '4 - Câblage en toiture',        label: 'Chemin de câbles / Propreté',                    exigence: 'Absence de perçage dans les capots' },
  { id: '4_9',  num: '4.9',  categorie: '4 - Câblage en toiture',        label: 'Section des câbles',                             exigence: 'Conforme au plan' },
  { id: '4_10', num: '4.10', categorie: '4 - Câblage en toiture',        label: 'Pénétration des câbles en toiture',              exigence: 'Propreté' },
  { id: '4_11', num: '4.11', categorie: '4 - Câblage en toiture',        label: 'Pénétration des câbles en toiture',              exigence: 'Étanchéité (protection par joint de carrossier)' },

  // 5. Pose des équipements électriques
  { id: '5_1',  num: '5.1',  categorie: '5 - Équipements électriques',   label: 'Onduleurs / TGBT',                               exigence: 'Signalétique' },
  { id: '5_2',  num: '5.2',  categorie: '5 - Équipements électriques',   label: 'Onduleurs / TGBT',                               exigence: 'Fixation' },
  { id: '5_3',  num: '5.3',  categorie: '5 - Équipements électriques',   label: 'Câblage (contrôle visuel)',                      exigence: 'Conforme aux plans' },
  { id: '5_4',  num: '5.4',  categorie: '5 - Équipements électriques',   label: 'Mise à la terre équipement',                    exigence: 'Connectée à la liaison équipotentielle — VALEUR DE TERRE' },
  { id: '5_5',  num: '5.5',  categorie: '5 - Équipements électriques',   label: 'Connecteurs CC coffrets / PE',                   exigence: 'Sertissage' },
  { id: '5_6',  num: '5.6',  categorie: '5 - Équipements électriques',   label: 'Connecteurs CC coffrets / PE',                   exigence: 'Fixation — Serrage conforme' },

  // 6. Local technique
  { id: '6_1',  num: '6.1',  categorie: '6 - Local technique',           label: 'Câblage',                                        exigence: 'Marquage "câbles sous tension"' },
  { id: '6_2',  num: '6.2',  categorie: '6 - Local technique',           label: 'Câblage',                                        exigence: 'Repérage des liaisons + et -' },
  { id: '6_3',  num: '6.3',  categorie: '6 - Local technique',           label: 'Point de pénétration',                           exigence: 'Étanchéité / Résistance au feu — Gaine coupe-feu' },
  { id: '6_4',  num: '6.4',  categorie: '6 - Local technique',           label: 'Propreté chemins de câbles',                     exigence: 'Tenue à la corrosion' },
  { id: '6_5',  num: '6.5',  categorie: '6 - Local technique',           label: 'Propreté chemins de câbles',                     exigence: 'Câbles peignés' },
  { id: '6_6',  num: '6.6',  categorie: '6 - Local technique',           label: 'Implantation appareillage',                      exigence: "Conforme aux plans d'exécution LT" },
  { id: '6_7',  num: '6.7',  categorie: '6 - Local technique',           label: 'Repérage des liaisons',                          exigence: "Conforme aux plans d'exécution LT" },
  { id: '6_8',  num: '6.8',  categorie: '6 - Local technique',           label: 'Mise à la terre des appareils',                  exigence: 'Connecté à la liaison équipotentielle' },
  { id: '6_9',  num: '6.9',  categorie: '6 - Local technique',           label: 'Signalétique',                                   exigence: '"Appareil sous tension"' },
  { id: '6_10', num: '6.10', categorie: '6 - Local technique',           label: 'TGBT — vérification avec pince ampèremétrique', exigence: 'Serrage des borniers' },
  { id: '6_11', num: '6.11', categorie: '6 - Local technique',           label: 'TGBT — vérification avec pince ampèremétrique', exigence: 'Fixation' },
  { id: '6_12', num: '6.12', categorie: '6 - Local technique',           label: 'TGBT — vérification avec pince ampèremétrique', exigence: 'Accessibilité' },
  { id: '6_13', num: '6.13', categorie: '6 - Local technique',           label: "Coupure d'urgence",                              exigence: 'Conforme au plan' },
  { id: '6_14', num: '6.14', categorie: '6 - Local technique',           label: 'Propreté du local technique',                    exigence: '' },

  // 7. Monitoring
  { id: '7_1',  num: '7.1',  categorie: '7 - Monitoring',                label: 'Repérage des liaisons',                          exigence: 'Conforme aux documents techniques' },
  { id: '7_2',  num: '7.2',  categorie: '7 - Monitoring',                label: 'Masse du coffret de monitoring',                 exigence: 'Connectée à la liaison équipotentielle' },
  { id: '7_3',  num: '7.3',  categorie: '7 - Monitoring',                label: 'Câbles ENEDIS → coffrets monitoring',            exigence: 'Présence' },
  { id: '7_4',  num: '7.4',  categorie: '7 - Monitoring',                label: 'Câbles Onduleurs → coffrets monitoring',         exigence: 'Présence' },
  { id: '7_5',  num: '7.5',  categorie: '7 - Monitoring',                label: 'Câbles Disjoncteur → coffrets monitoring',       exigence: 'Présence' },
  { id: '7_6',  num: '7.6',  categorie: '7 - Monitoring',                label: 'Implantation du monitoring',                     exigence: 'Conforme au synoptique de communication' },
  { id: '7_7',  num: '7.7',  categorie: '7 - Monitoring',                label: 'Implantation du monitoring',                     exigence: 'Capteur coffret monitoring installé' },
  { id: '7_8',  num: '7.8',  categorie: '7 - Monitoring',                label: 'Afficheur / Téléviseur',                         exigence: 'Fonctionnement' },
  { id: '7_9',  num: '7.9',  categorie: '7 - Monitoring',                label: 'Afficheur / Téléviseur',                         exigence: 'Connecteurs' },
  { id: '7_10', num: '7.10', categorie: '7 - Monitoring',                label: 'Alimentation électrique',                        exigence: 'Système de monitoring alimenté' },
  { id: '7_11', num: '7.11', categorie: '7 - Monitoring',                label: 'Connexion internet',                             exigence: 'Connexion Ethernet ou GSM' },

  // 8. Logette — Injection
  { id: '8_1',  num: '8.1',  categorie: '8 - Logette / Injection',       label: "Câbles d'injection",                             exigence: 'Repérage des câbles (Photo)' },
  { id: '8_2',  num: '8.2',  categorie: '8 - Logette / Injection',       label: 'Positionnement du neutre',                       exigence: 'Bon positionnement du neutre' },
  { id: '8_3',  num: '8.3',  categorie: '8 - Logette / Injection',       label: 'Conformité logette',                             exigence: 'Vérification conformité massif béton logette' },
]

export function initChecks(): AutoControleCheck[] {
  return CHECKS_DEFAUT.map(c => ({ ...c, result: null, commentaire: '' }))
}

export function useAutoControle(chantierId: string) {
  const [autocontrole, setAutocontrole] = useState<AutoControle | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('autocontrole')
      .select('*')
      .eq('chantier_id', chantierId)
      .maybeSingle()
    setAutocontrole(data)
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetch() }, [fetch])

  async function save(checks: AutoControleCheck[], commentaire: string, technicienId: string) {
    if (autocontrole) {
      await supabase
        .from('autocontrole')
        .update({ checks, commentaire, updated_at: new Date().toISOString() })
        .eq('id', autocontrole.id)
    } else {
      await supabase
        .from('autocontrole')
        .insert({ chantier_id: chantierId, technicien_id: technicienId, checks, commentaire })
    }
    await fetch()
  }

  async function signer(checks: AutoControleCheck[], commentaire: string, technicienId: string) {
    const now = new Date().toISOString()
    if (autocontrole) {
      await supabase
        .from('autocontrole')
        .update({ checks, commentaire, signe_le: now, updated_at: now })
        .eq('id', autocontrole.id)
    } else {
      await supabase
        .from('autocontrole')
        .insert({ chantier_id: chantierId, technicien_id: technicienId, checks, commentaire, signe_le: now })
    }
    await fetch()
  }

  return { autocontrole, loading, save, signer, refetch: fetch }
}
