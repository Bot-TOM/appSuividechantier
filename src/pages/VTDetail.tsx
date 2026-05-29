import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useVisiteTechnique } from '@/hooks/useVisitesTechniques'
import { isManagerRole } from '@/types'
import { ChevronLeft, CheckCircle, FileDown, X, Pencil, Trash2 } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { pdf } from '@react-pdf/renderer'
import { VTPdfDocument } from '@/components/vt/VTPdf'

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === '') return null
  const display = Array.isArray(value) ? (value as string[]).join(', ') : String(value)
  if (!display) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 w-48 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{display}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      <div className="px-6 py-2">{children}</div>
    </div>
  )
}

const TYPE_LABEL = { btoc: 'BtoC', btob: 'BtoB' }
const TYPE_COLOR = {
  btoc: 'bg-purple-50 text-purple-700 border border-purple-200',
  btob: 'bg-blue-50 text-blue-700 border border-blue-200',
}
const STATUT_LABEL = { brouillon: 'Brouillon', complete: 'Complété', valide: 'Validé' }
const STATUT_COLOR = {
  brouillon: 'bg-gray-100 text-gray-600',
  complete: 'bg-blue-50 text-blue-700',
  valide: 'bg-emerald-50 text-emerald-700',
}

// ─── Page VTDetail ────────────────────────────────────────────────────────────

export default function VTDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { vt, loading, valider, deleteVT } = useVisiteTechnique(id ?? '')

  const [validating, setValidating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const isManager = isManagerRole(profile?.role)
  const canValidate = isManager && vt?.statut === 'complete'
  const canEdit = vt?.statut !== 'valide' && (isManager || profile?.id === vt?.technicien_id)
  const canDelete = isManager

  async function handleDelete() {
    setDeleting(true)
    await deleteVT()
    navigate(-1)
  }

  async function handleValider() {
    if (!profile?.id || !id) return
    setValidating(true)
    await valider(profile.id)
    setValidating(false)
  }

  async function handleExportPdf() {
    if (!vt) return
    setExporting(true)
    const blob = await pdf(<VTPdfDocument vt={vt} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VT_${vt.client_nom ?? vt.id}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!vt) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-500">Visite technique introuvable</p>
          <button onClick={() => navigate(-1)} className="text-orange-600 text-sm font-medium hover:underline">
            Retour
          </button>
        </div>
      </div>
    )
  }

  const data = vt.data
  const isBtoc = vt.type === 'btoc'
  const photos = (data['photos'] as Record<string, string[]> | undefined) ?? {}
  const allPhotos = Object.entries(photos).flatMap(([zone, urls]) =>
    (urls ?? []).map(url => ({ zone, url }))
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 pt-0.5"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">VT</span>
              </button>
              <div className="min-w-0">
                <h1 className="font-bold text-slate-900 text-lg truncate">
                  {(vt.data as Record<string, unknown>)?.['nom_projet'] as string || vt.client_nom || 'VT sans titre'}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${TYPE_COLOR[vt.type]}`}>
                    {TYPE_LABEL[vt.type]}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${STATUT_COLOR[vt.statut]}`}>
                    {STATUT_LABEL[vt.statut]}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => navigate(`/vt/${vt.id}/modifier`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">{vt.statut === 'brouillon' ? 'Reprendre' : 'Modifier'}</span>
                </button>
              )}
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              {canValidate && (
                <button
                  onClick={handleValider}
                  disabled={validating}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{validating ? 'Validation...' : 'Valider la VT'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Infos technicien */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {vt.profiles && (
              <>
                <Avatar name={vt.profiles.full_name} avatarUrl={vt.profiles.avatar_url} size="md" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{vt.profiles.full_name}</p>
                  <p className="text-xs text-slate-400">Technicien</p>
                </div>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Créée le</p>
            <p className="text-sm font-medium text-slate-700">
              {new Date(vt.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Si validée */}
        {vt.statut === 'valide' && vt.valide_le && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Visite validée</p>
              <p className="text-xs text-emerald-600">
                le {new Date(vt.valide_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* Sections données BtoC */}
        {isBtoc && (
          <>
            <Section title="Informations générales">
              <InfoRow label="Nom du projet" value={data['nom_projet']} />
              <InfoRow label="Client" value={data['client_nom']} />
              <InfoRow label="Adresse" value={data['client_adresse']} />
              <InfoRow label="Téléphone" value={data['client_telephone']} />
              <InfoRow label="Email" value={data['client_email']} />
              <InfoRow label="Panneaux" value={data['panneaux']} />
              <InfoRow label="Onduleur" value={data['onduleur']} />
            </Section>

            <Section title="Électrique">
              <InfoRow label="Abonnement" value={data['abonnement']} />
              <InfoRow label="Puissance souscrite" value={data['puissance_souscrite']} />
              <InfoRow label="Disjoncteur 30mA" value={data['differentiel_30ma']} />
              <InfoRow label="Place tableau" value={data['place_tableau']} />
              <InfoRow label="Espace onduleur" value={data['espace_onduleur']} />
              <InfoRow label="Bornier tableau" value={data['bornier_tableau']} />
              <InfoRow label="Traversée difficile" value={data['traversee_difficile']} />
              <InfoRow label="Dist. panneaux → coffret" value={data['distance_panneaux_coffret']} />
              <InfoRow label="Dist. tableau → onduleur" value={data['distance_tableau_onduleur']} />
              <InfoRow label="Tube IRO Ø (mm)" value={data['tube_iro_diam']} />
              <InfoRow label="Gaine Ø (mm)" value={data['gaine_diam']} />
              <InfoRow label="Goulotte couleur" value={data['goulotte_couleur']} />
              <InfoRow label="Wi-Fi" value={data['wifi']} />
              <InfoRow label="Code Wi-Fi" value={data['code_wifi']} />
            </Section>

            <Section title="Couverture">
              <InfoRow label="Nature bâtiment" value={data['nature_batiment']} />
              <InfoRow label="Type couverture" value={data['type_couverture']} />
              <InfoRow label="Obstacles" value={data['obstacles']} />
              <InfoRow label="Type tuile" value={data['type_tuile']} />
              <InfoRow label="Fixation tuile" value={data['fixation_tuile']} />
              <InfoRow label="Nature charpente" value={data['nature_charpente']} />
              <InfoRow label="Solivages" value={data['solivages']} />
              <InfoRow label="Épaisseur liteaux (mm)" value={data['epaisseur_liteaux']} />
              <InfoRow label="Entraxe (mm)" value={data['entraxe']} />
              <InfoRow label="Solives visibles" value={data['solives_visibles']} />
              <InfoRow label="Combles" value={data['combles']} />
              <InfoRow label="Nature rives" value={data['nature_rives']} />
              <InfoRow label="Nature faîtage" value={data['nature_faitage']} />
              <InfoRow label="Échafaudage" value={data['echafaudage']} />
              <InfoRow label="Hauteur planchée (m)" value={data['hauteur_planchee']} />
              <InfoRow label="Éléments sécurité" value={data['elements_securite']} />
            </Section>

            <Section title="Calepinage">
              <InfoRow label="Nature installation" value={data['nature_installation']} />
              <InfoRow label="Type fixation" value={data['type_fixation']} />
              <InfoRow label="Tuiles en stock" value={data['tuiles_stock']} />
              <InfoRow label="Dist. bas pente (m)" value={data['dist_bas_pente']} />
              <InfoRow label="Dist. haut pente (m)" value={data['dist_haut_pente']} />
              <InfoRow label="Dist. rive gauche (m)" value={data['dist_rive_gauche']} />
              <InfoRow label="Dist. rive droite (m)" value={data['dist_rive_droite']} />
              {[1, 2, 3, 4, 5].map(n => (
                <InfoRow key={n} label={`Dist. ${n}${n === 1 ? 'ère' : 'ème'} poutre (m)`} value={data[`dist_${n}ere_poutre`]} />
              ))}
              <InfoRow label="Borne recharge" value={data['borne_recharge']} />
              <InfoRow label="Validation calepinage" value={data['validation_calepinage']} />
              <InfoRow label="Raison non-validation" value={data['raison_non_validation']} />
              <InfoRow label="Temps estimé" value={data['temps_estime']} />
              <InfoRow label="Difficultés" value={data['difficultes']} />
            </Section>
          </>
        )}

        {/* Sections données BtoB */}
        {!isBtoc && (
          <>
            <Section title="Informations générales">
              <InfoRow label="Nom du projet" value={data['nom_projet']} />
              <InfoRow label="Adresse site" value={data['adresse_site']} />
              <InfoRow label="Client" value={data['client_nom']} />
              <InfoRow label="Contact client" value={data['contact_client']} />
              <InfoRow label="Type bâtiment" value={data['type_batiment']} />
              <InfoRow label="Puissance (kWc)" value={data['puissance_kwc']} />
            </Section>

            <Section title="Couverture">
              <InfoRow label="Orientation" value={data['orientation']} />
              <InfoRow label="Type couverture" value={data['type_couverture']} />
              <InfoRow label="Complexe étanchéité" value={data['complexe_etancheite']} />
              <InfoRow label="État toiture" value={data['etat_toiture']} />
              <InfoRow label="Longueur pan (m)" value={data['longueur_pan']} />
              <InfoRow label="Largeur pan (m)" value={data['largeur_pan']} />
              <InfoRow label="Entraxes pannes (m)" value={data['entraxes_pannes']} />
              <InfoRow label="Obstacles" value={data['obstacles']} />
              <InfoRow label="Ombrages" value={data['ombrages']} />
              <InfoRow label="Ondes bac acier (mm)" value={data['ondes_bac_acier']} />
              <InfoRow label="Nettoyage" value={data['nettoyage']} />
            </Section>

            <Section title="Structure">
              <InfoRow label="H bas pente (m)" value={data['h_bas_pente']} />
              <InfoRow label="H faîtage (m)" value={data['h_faitage']} />
              <InfoRow label="H acrotère (m)" value={data['h_acrotere']} />
              <InfoRow label="L acrotère (m)" value={data['l_acrotere']} />
              <InfoRow label="L bâtiment (m)" value={data['l_batiment']} />
              <InfoRow label="Larg. bâtiment (m)" value={data['larg_batiment']} />
              <InfoRow label="Type structure" value={data['type_structure']} />
              <InfoRow label="Type panne" value={data['type_panne']} />
              <InfoRow label="État structure" value={data['etat_structure']} />
              <InfoRow label="Accès combles" value={data['acces_combles']} />
            </Section>

            <Section title="Électrique">
              <InfoRow label="Shelter nécessaire" value={data['shelter_necessaire']} />
              <InfoRow label="Position logette GRD" value={data['position_logette_grd']} />
              <InfoRow label="Nb PDL" value={data['nb_pdl']} />
              <InfoRow label="Type raccordement" value={data['type_raccordement']} />
              <InfoRow label="Type compteur" value={data['type_compteur']} />
              <InfoRow label="Position compteur" value={data['position_compteur']} />
              <InfoRow label="Groupe électrogène" value={data['groupe_electrogene']} />
              <InfoRow label="Position TGBT" value={data['position_tgbt']} />
              <InfoRow label="Distance TGBT (m)" value={data['distance_tgbt']} />
              <InfoRow label="Position baie info" value={data['position_baie_info']} />
              <InfoRow label="Position arrêt d'urgence" value={data['position_arret_urgence']} />
              <InfoRow label="Position onduleurs" value={data['position_onduleurs']} />
              <InfoRow label="Section câbles" value={data['section_cables']} />
              <InfoRow label="Difficulté coupure" value={data['difficulte_coupure']} />
            </Section>

            {(data['shelter_necessaire'] as string) === 'Oui' && (
              <Section title="Shelter">
                <InfoRow label="Position shelter" value={data['position_shelter']} />
                <InfoRow label="Dalle béton" value={data['dalle_beton']} />
                <InfoRow label="État dalle" value={data['etat_dalle']} />
                <InfoRow label="Dimensions dalle" value={data['dim_dalle']} />
                <InfoRow label="Tranchées existantes nb" value={data['tranchees_existantes_nb']} />
                <InfoRow label="Tranchées existantes longueur" value={data['tranchees_existantes_longueur']} />
                <InfoRow label="Tranchées à créer nb" value={data['tranchees_creer_nb']} />
                <InfoRow label="Tranchées à créer longueur" value={data['tranchees_creer_longueur']} />
              </Section>
            )}

            <Section title="Sécurité">
              <InfoRow label="Moyen de levage" value={data['moyen_levage']} />
              <InfoRow label="Surface sol" value={data['surface_sol']} />
              <InfoRow label="Largeur voie (m)" value={data['largeur_voie']} />
              <InfoRow label="Zones et notes" value={data['zones_notes']} />
              <InfoRow label="EPC existant" value={data['epc_existant']} />
            </Section>

            <Section title="Administratif">
              <InfoRow label="Panneau DP" value={data['presence_panneau_dp']} />
              <InfoRow label="Contraintes" value={data['contraintes']} />
              <InfoRow label="Règles d'accès" value={data['regles_acces']} />
              <InfoRow label="Bureau de contrôle" value={data['bureau_controle']} />
              <InfoRow label="Infos MES" value={data['info_mes']} />
              <InfoRow label="Banderole Hellio" value={data['banderole_hellio']} />
              <InfoRow label="Contacts client" value={data['contacts_client']} />
              <InfoRow label="Contacts externes" value={data['contacts_externes']} />
              <InfoRow label="Documents transmis" value={data['documents_transmis']} />
              <InfoRow label="Commentaires" value={data['commentaires']} />
              <InfoRow label="Difficultés" value={data['difficultes']} />
            </Section>
          </>
        )}

        {/* Photos */}
        {allPhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-900 text-sm">Photos ({allPhotos.length})</h3>
            </div>
            <div className="p-6 space-y-4">
              {Object.entries(photos).map(([zone, urls]) => (
                urls && urls.length > 0 ? (
                  <div key={zone}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{zone}</p>
                    <div className="flex flex-wrap gap-2">
                      {urls.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxUrl(url)}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 hover:border-orange-400 transition-colors"
                        >
                          <img src={url} alt={`${zone} ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Supprimer cette VT ?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {vt.client_nom ?? 'VT sans titre'} — {vt.type === 'btoc' ? 'BtoC' : 'BtoB'}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">Cette action est irréversible. Toutes les données et photos seront supprimées.</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Photo"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
