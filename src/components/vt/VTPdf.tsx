import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { VisiteTechnique } from '@/types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1e293b',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#EA580C',
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#EA580C',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#EA580C',
    backgroundColor: '#fff7ed',
    padding: '4 8',
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EA580C',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: {
    width: '40%',
    color: '#64748b',
    fontSize: 9,
  },
  rowValue: {
    width: '60%',
    color: '#1e293b',
    fontSize: 9,
  },
  badge: {
    backgroundColor: '#fff7ed',
    color: '#EA580C',
    padding: '2 6',
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-start',
  },
  photosZoneTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 160,
    height: 120,
    objectFit: 'cover',
    borderRadius: 4,
  },
})

function DataSection({ title, fields, data }: { title: string; fields: [string, string][]; data: Record<string, unknown> }) {
  const rows = fields.filter(([key]) => data[key] !== undefined && data[key] !== '' && data[key] !== null)
  if (rows.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map(([key, label]) => {
        const val = data[key]
        const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val ?? '')
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{display}</Text>
          </View>
        )
      })}
    </View>
  )
}

export function VTPdfDocument({ vt }: { vt: VisiteTechnique }) {
  const data = vt.data
  const isBtoc = vt.type === 'btoc'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Visite Technique — {isBtoc ? 'BtoC (Résidentiel)' : 'BtoB (Professionnel)'}</Text>
          <Text style={styles.subtitle}>{vt.client_nom ?? 'Sans titre'}</Text>
        </View>

        {/* Méta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{new Date(vt.created_at).toLocaleDateString('fr-FR')}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Adresse</Text>
            <Text style={styles.metaValue}>{vt.client_adresse ?? '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Technicien</Text>
            <Text style={styles.metaValue}>{vt.profiles?.full_name ?? '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Statut</Text>
            <Text style={[styles.badge, { fontSize: 8 }]}>
              {vt.statut === 'brouillon' ? 'Brouillon' : vt.statut === 'complete' ? 'Complété' : 'Validé'}
            </Text>
          </View>
        </View>

        {/* Sections BtoC */}
        {isBtoc && (
          <>
            <DataSection title="Informations générales" fields={[
              ['nom_projet', 'Nom du projet'],
              ['client_nom', 'Client'],
              ['client_adresse', 'Adresse'],
              ['client_telephone', 'Téléphone'],
              ['client_email', 'Email'],
              ['panneaux', 'Panneaux'],
              ['onduleur', 'Onduleur'],
            ]} data={data} />

            <DataSection title="Électrique" fields={[
              ['abonnement', 'Abonnement'],
              ['puissance_souscrite', 'Puissance souscrite'],
              ['differentiel_30ma', 'Disjoncteur 30mA'],
              ['place_tableau', 'Place tableau'],
              ['espace_onduleur', 'Espace onduleur'],
              ['bornier_tableau', 'Bornier tableau'],
              ['traversee_difficile', 'Traversée difficile'],
              ['distance_panneaux_coffret', 'Dist. panneaux → coffret'],
              ['distance_tableau_onduleur', 'Dist. tableau → onduleur'],
              ['tube_iro_diam', 'Tube IRO Ø (mm)'],
              ['gaine_diam', 'Gaine Ø (mm)'],
              ['goulotte_couleur', 'Goulotte couleur'],
              ['wifi', 'Wi-Fi'],
              ['code_wifi', 'Code Wi-Fi'],
            ]} data={data} />

            <DataSection title="Couverture" fields={[
              ['nature_batiment', 'Nature bâtiment'],
              ['type_couverture', 'Type couverture'],
              ['obstacles', 'Obstacles'],
              ['type_tuile', 'Type tuile'],
              ['fixation_tuile', 'Fixation tuile'],
              ['nature_charpente', 'Nature charpente'],
              ['solivages', 'Solivages'],
              ['epaisseur_liteaux', 'Épaisseur liteaux (mm)'],
              ['entraxe', 'Entraxe (mm)'],
              ['solives_visibles', 'Solives visibles'],
              ['combles', 'Combles'],
              ['nature_rives', 'Nature rives'],
              ['nature_faitage', 'Nature faîtage'],
              ['echafaudage', 'Échafaudage'],
              ['hauteur_planchee', 'Hauteur planchée (m)'],
              ['elements_securite', 'Éléments sécurité'],
            ]} data={data} />

            <DataSection title="Calepinage" fields={[
              ['nature_installation', 'Nature installation'],
              ['type_fixation', 'Type fixation'],
              ['tuiles_stock', 'Tuiles en stock'],
              ['dist_bas_pente', 'Dist. bas pente (m)'],
              ['dist_haut_pente', 'Dist. haut pente (m)'],
              ['dist_rive_gauche', 'Dist. rive gauche (m)'],
              ['dist_rive_droite', 'Dist. rive droite (m)'],
              ['borne_recharge', 'Borne recharge'],
              ['validation_calepinage', 'Validation calepinage'],
              ['raison_non_validation', 'Raison non-validation'],
              ['temps_estime', 'Temps estimé'],
              ['difficultes', 'Difficultés'],
            ]} data={data} />
          </>
        )}

        {/* Sections BtoB */}
        {!isBtoc && (
          <>
            <DataSection title="Informations générales" fields={[
              ['nom_projet', 'Nom du projet'],
              ['adresse_site', 'Adresse site'],
              ['client_nom', 'Client'],
              ['contact_client', 'Contact client'],
              ['type_batiment', 'Type bâtiment'],
              ['puissance_kwc', 'Puissance (kWc)'],
            ]} data={data} />

            <DataSection title="Couverture" fields={[
              ['orientation', 'Orientation'],
              ['type_couverture', 'Type couverture'],
              ['complexe_etancheite', "Complexe d'étanchéité"],
              ['etat_toiture', 'État toiture'],
              ['longueur_pan', 'Longueur pan (m)'],
              ['largeur_pan', 'Largeur pan (m)'],
              ['entraxes_pannes', 'Entraxes pannes (m)'],
              ['obstacles', 'Obstacles'],
              ['ombrages', 'Ombrages'],
              ['ondes_bac_acier', 'Ondes bac acier (mm)'],
              ['nettoyage', 'Nettoyage'],
            ]} data={data} />

            <DataSection title="Structure" fields={[
              ['h_bas_pente', 'H bas pente (m)'],
              ['h_faitage', 'H faîtage (m)'],
              ['h_acrotere', 'H acrotère (m)'],
              ['l_acrotere', 'L acrotère (m)'],
              ['l_batiment', 'L bâtiment (m)'],
              ['larg_batiment', 'Larg. bâtiment (m)'],
              ['type_structure', 'Type structure'],
              ['type_panne', 'Type panne'],
              ['etat_structure', 'État structure'],
              ['acces_combles', 'Accès combles'],
            ]} data={data} />

            <DataSection title="Électrique" fields={[
              ['shelter_necessaire', 'Shelter nécessaire'],
              ['position_logette_grd', 'Position logette GRD'],
              ['nb_pdl', 'Nb PDL'],
              ['type_raccordement', 'Type raccordement'],
              ['type_compteur', 'Type compteur'],
              ['position_compteur', 'Position compteur'],
              ['groupe_electrogene', 'Groupe électrogène'],
              ['position_tgbt', 'Position TGBT'],
              ['distance_tgbt', 'Distance TGBT (m)'],
              ['position_baie_info', 'Position baie info'],
              ['position_arret_urgence', "Position arrêt d'urgence"],
              ['position_onduleurs', 'Position onduleurs'],
              ['section_cables', 'Section câbles'],
              ['difficulte_coupure', 'Difficulté coupure'],
            ]} data={data} />

            <DataSection title="Sécurité" fields={[
              ['moyen_levage', 'Moyen de levage'],
              ['surface_sol', 'Surface sol'],
              ['largeur_voie', 'Largeur voie (m)'],
              ['zones_notes', 'Zones et notes'],
              ['epc_existant', 'EPC existant'],
            ]} data={data} />

            <DataSection title="Administratif" fields={[
              ['presence_panneau_dp', 'Panneau DP'],
              ['contraintes', 'Contraintes'],
              ['regles_acces', "Règles d'accès"],
              ['bureau_controle', 'Bureau de contrôle'],
              ['info_mes', 'Infos MES'],
              ['banderole_hellio', 'Banderole Hellio'],
              ['contacts_client', 'Contacts client'],
              ['contacts_externes', 'Contacts externes'],
              ['documents_transmis', 'Documents transmis'],
              ['commentaires', 'Commentaires'],
              ['difficultes', 'Difficultés'],
            ]} data={data} />
          </>
        )}
      </Page>

      {/* Page photos */}
      {(() => {
        const ZONE_LABELS: Record<string, string> = {
          electrique: 'Électrique',
          couverture: 'Couverture',
          general: 'Général',
          toiture: 'Toiture',
          structure: 'Structure',
        }
        const photos = (data['photos'] ?? {}) as Record<string, string[]>
        const zones = Object.entries(photos).filter(([, urls]) => urls && urls.length > 0)
        if (zones.length === 0) return null
        return (
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>Photos — {isBtoc ? 'BtoC (Résidentiel)' : 'BtoB (Professionnel)'}</Text>
              <Text style={styles.subtitle}>{vt.client_nom ?? 'Sans titre'}</Text>
            </View>
            {zones.map(([zone, urls]) => (
              <View key={zone}>
                <Text style={styles.photosZoneTitle}>{ZONE_LABELS[zone] ?? zone}</Text>
                <View style={styles.photosGrid}>
                  {urls.map((url, i) => (
                    <Image key={i} src={url} style={styles.photo} />
                  ))}
                </View>
              </View>
            ))}
          </Page>
        )
      })()}
    </Document>
  )
}
