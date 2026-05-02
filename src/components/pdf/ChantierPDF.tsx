import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { Chantier, Etape, EtapePhoto, Note, Anomalie } from '@/types'

const S = StyleSheet.create({
  page:        { padding: 40, backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#f97316', marginBottom: 4 },
  headerSub:   { fontSize: 9, color: '#6b7280' },
  headerDate:  { fontSize: 9, color: '#9ca3af', textAlign: 'right' },
  divider:     { height: 1, backgroundColor: '#f3f4f6', marginVertical: 14 },
  section:     { marginBottom: 20 },
  sectionTitle:{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoBox:  { width: '47%', backgroundColor: '#f9fafb', borderRadius: 6, padding: 10, marginBottom: 8, marginRight: '3%' },
  infoLabel:{ fontSize: 8, color: '#9ca3af', marginBottom: 3 },
  infoValue:{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },

  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, fontSize: 9, fontFamily: 'Helvetica-Bold' },

  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressBar:  { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 14 },
  progressFill: { height: 8, borderRadius: 4 },

  etapeRow:   { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  etapeTop:   { flexDirection: 'row', alignItems: 'center' },
  checkbox:   { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  etapeNom:   { flex: 1, fontSize: 10 },
  etapePhoto: { width: 180, height: 120, borderRadius: 6, marginTop: 6, marginLeft: 22 },

  noteBox:  { backgroundColor: '#f9fafb', borderRadius: 6, padding: 10, marginBottom: 8 },
  noteMeta: { fontSize: 8, color: '#9ca3af', marginTop: 4 },

  anomalieBox:   { borderRadius: 6, padding: 10, marginBottom: 8, borderLeftWidth: 3 },
  anomalieTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  anomalieDesc:  { fontSize: 9, color: '#374151' },
  anomalieMeta:  { fontSize: 8, color: '#9ca3af', marginTop: 4 },

  footer:    { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt: { fontSize: 8, color: '#d1d5db' },
})

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente', en_cours: 'En cours', termine: 'Termine', bloque: 'Bloque',
}
const STATUT_COLOR: Record<string, string> = {
  en_attente: '#6b7280', en_cours: '#3b82f6', termine: '#22c55e', bloque: '#ef4444',
}
const GRAVITE_COLOR: Record<string, string> = {
  haute: '#ef4444', moyenne: '#f97316', basse: '#eab308',
}

function safeDate(iso: string | undefined | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return '-' }
}
function safeStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

interface Props {
  chantier:  Chantier
  etapes:    Etape[]
  photos:    Record<string, EtapePhoto[]>
  notes:     (Note & { profiles?: { full_name?: string } | null })[]
  anomalies: (Anomalie & { profiles?: { full_name?: string } | null })[]
}

export default function ChantierPDF({ chantier, etapes, photos, notes, anomalies }: Props) {
  const faites = etapes.filter(e => e.statut === 'fait').length
  const pct    = etapes.length === 0 ? 0 : Math.round((faites / etapes.length) * 100)

  return (
    <Document title={`Rapport - ${safeStr(chantier.nom)}`} author="SolarTrack">
      <Page size="A4" style={S.page}>

        {/* HEADER */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.headerTitle}>RAPPORT DE CHANTIER</Text>
            <Text style={S.headerSub}>SolarTrack - Suivi chantier PV</Text>
          </View>
          <Text style={S.headerDate}>Genere le {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

        {/* INFOS */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Informations chantier</Text>
          <View style={S.infoGrid}>
            {[
              { label: 'CHANTIER',   value: chantier.nom },
              { label: 'CLIENT',     value: chantier.client_nom },
              { label: 'ADRESSE',    value: chantier.client_adresse },
              { label: 'TYPE',       value: chantier.type_installation },
              { label: 'PANNEAUX',   value: String(chantier.nb_panneaux) },
              { label: 'DATE PREVUE',value: safeDate(chantier.date_prevue) },
            ].map(({ label, value }) => (
              <View key={label} style={S.infoBox}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={S.infoValue}>{safeStr(value)}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Text style={[S.badge, {
              backgroundColor: (STATUT_COLOR[chantier.statut] ?? '#6b7280') + '20',
              color: STATUT_COLOR[chantier.statut] ?? '#6b7280',
            }]}>
              {STATUT_LABEL[chantier.statut] ?? chantier.statut}
            </Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* ETAPES */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Avancement ({faites}/{etapes.length} etapes)</Text>
          <View style={S.progressRow}>
            <Text style={{ color: '#6b7280' }}>{faites} completees sur {etapes.length}</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: pct === 100 ? '#22c55e' : '#f97316' }}>{pct}%</Text>
          </View>
          <View style={S.progressBar}>
            <View style={[S.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#f97316' }]} />
          </View>
          {etapes.map(e => (
            <View key={e.id} style={S.etapeRow}>
              <View style={S.etapeTop}>
                <View style={[S.checkbox, {
                  borderColor: e.statut === 'fait' ? '#f97316' : '#d1d5db',
                  backgroundColor: e.statut === 'fait' ? '#f97316' : 'transparent',
                }]}>
                  {e.statut === 'fait' && <Text style={{ fontSize: 7, color: 'white' }}>OK</Text>}
                </View>
                <Text style={[S.etapeNom, { color: e.statut === 'fait' ? '#9ca3af' : '#111827' }]}>
                  {safeStr(e.nom)}
                </Text>
                {e.consigne
                  ? <Text style={{ fontSize: 8, color: '#9ca3af', marginRight: 8 }}>{safeStr(e.consigne)}</Text>
                  : null
                }
                <Text style={{ fontSize: 8, color: '#9ca3af' }}>
                  {e.statut === 'fait' ? 'Fait' : e.statut === 'en_cours' ? 'En cours' : 'A faire'}
                </Text>
              </View>
              {(photos[e.id] ?? []).map(p => (
                <Image key={p.id} style={S.etapePhoto} src={p.url} />
              ))}
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* ANOMALIES */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Anomalies ({anomalies.length})</Text>
          {anomalies.length === 0
            ? <Text style={{ color: '#9ca3af', fontSize: 9 }}>Aucune anomalie signalee.</Text>
            : anomalies.map(a => (
              <View key={a.id} style={[S.anomalieBox, {
                borderLeftColor: GRAVITE_COLOR[a.gravite] ?? '#6b7280',
                backgroundColor: (GRAVITE_COLOR[a.gravite] ?? '#6b7280') + '10',
              }]}>
                <Text style={S.anomalieTitle}>{safeStr(a.type)} — {safeStr(a.gravite)}</Text>
                <Text style={S.anomalieDesc}>{safeStr(a.description)}</Text>
                <Text style={S.anomalieMeta}>
                  {a.statut === 'resolu' ? 'Resolu' : a.statut === 'en_cours' ? 'En cours' : 'Ouvert'}{' '}
                  — {safeDate(a.created_at)}
                </Text>
              </View>
            ))
          }
        </View>

        <View style={S.divider} />

        {/* NOTES */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Notes terrain ({notes.length})</Text>
          {notes.length === 0
            ? <Text style={{ color: '#9ca3af', fontSize: 9 }}>Aucune note.</Text>
            : notes.map(n => (
              <View key={n.id} style={S.noteBox}>
                <Text>{safeStr(n.contenu)}</Text>
                <Text style={S.noteMeta}>
                  {safeStr(n.profiles?.full_name)} — {safeDate(n.created_at)}
                </Text>
              </View>
            ))
          }
        </View>

        {/* FOOTER */}
        <View style={S.footer} fixed>
          <Text style={S.footerTxt}>SolarTrack</Text>
          <Text style={S.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
