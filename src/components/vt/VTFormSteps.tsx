import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
    />
  )
}

export function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 resize-none"
    />
  )
}

export function RadioGroup({ name, options, value, onChange }: {
  name: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="accent-orange-500" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

export function CheckboxGroup({ options, value, onChange }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt])
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="accent-orange-500 rounded" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

export function OuiNon({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  return <RadioGroup name={name} options={['Oui', 'Non']} value={value} onChange={onChange} />
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-gray-900 mb-4 text-base">{children}</h3>
}

// ─── Photos step (partagé BtoC et BtoB) ──────────────────────────────────────

export function PhotosStep({
  data, onChange, vtId, zones
}: {
  data: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
  vtId: string
  zones: { label: string; key: string }[]
}) {
  const photos = (data['photos'] as Record<string, string[]> | undefined) ?? {}
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleUpload(zoneKey: string, file: File) {
    setUploading(u => ({ ...u, [zoneKey]: true }))
    setErrors(e => ({ ...e, [zoneKey]: '' }))
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    // Chemin 100% ASCII — pas d'accents pour éviter les erreurs Supabase Storage
    const path = `${vtId}/${zoneKey}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vt-photos').upload(path, file, { upsert: false })
    if (error) {
      setErrors(e => ({ ...e, [zoneKey]: `Erreur upload : ${error.message}` }))
    } else {
      const { data: { publicUrl } } = supabase.storage.from('vt-photos').getPublicUrl(path)
      const prev = photos[zoneKey] ?? []
      onChange({ ...data, photos: { ...photos, [zoneKey]: [...prev, publicUrl] } })
    }
    setUploading(u => ({ ...u, [zoneKey]: false }))
  }

  function handleRemove(zoneKey: string, idx: number) {
    const prev = photos[zoneKey] ?? []
    onChange({ ...data, photos: { ...photos, [zoneKey]: prev.filter((_, i) => i !== idx) } })
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Photos</SectionTitle>
      {zones.map(({ label, key }) => (
        <div key={key} className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
          {(photos[key] ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(photos[key] ?? []).map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`${label} ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
                  <button
                    onClick={() => handleRemove(key, i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
          <div className="flex gap-2 flex-wrap">
            {/* Bouton appareil photo */}
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-50 transition-colors">
              {uploading[key] ? (
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>📷 Prendre une photo</span>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploading[key]}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(key, file)
                  e.target.value = ''
                }}
              />
            </label>
            {/* Bouton galerie */}
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-50 transition-colors">
              {uploading[key] ? (
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>🖼️ Depuis la galerie</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading[key]}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(key, file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Étapes BtoC ─────────────────────────────────────────────────────────────

type StepProps = { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }

export function BToCStep1({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <SectionTitle>Informations générales</SectionTitle>
      <Field label="Nom du projet"><TextInput value={f('nom_projet')} onChange={s('nom_projet')} /></Field>
      <Field label="Nom du client"><TextInput value={f('client_nom')} onChange={s('client_nom')} /></Field>
      <Field label="Adresse"><TextInput value={f('client_adresse')} onChange={s('client_adresse')} /></Field>
      <Field label="Téléphone"><TextInput value={f('client_telephone')} onChange={s('client_telephone')} /></Field>
      <Field label="Email"><TextInput value={f('client_email')} onChange={s('client_email')} /></Field>
      <Field label="Panneaux"><TextInput value={f('panneaux')} onChange={s('panneaux')} /></Field>
      <Field label="Onduleur"><TextInput value={f('onduleur')} onChange={s('onduleur')} /></Field>
    </div>
  )
}

export function BToCStep2({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const a = (k: string) => (data[k] as string[]) ?? []
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  const sc = (k: string) => (v: string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Électrique</SectionTitle>
      <Field label="Abonnement">
        <RadioGroup name="abonnement" options={['Mono', 'Triphasé']} value={f('abonnement')} onChange={s('abonnement')} />
      </Field>
      <Field label="Puissance souscrite">
        <RadioGroup name="puissance_souscrite" options={['3kVA', '6kVA', '9kVA', '12kVA', 'Autre']} value={f('puissance_souscrite')} onChange={s('puissance_souscrite')} />
      </Field>
      <Field label="Disjoncteur différentiel 30mA"><OuiNon name="diff30" value={f('differentiel_30ma')} onChange={s('differentiel_30ma')} /></Field>
      <Field label="Place dans le tableau"><OuiNon name="place_tab" value={f('place_tableau')} onChange={s('place_tableau')} /></Field>
      <Field label="Espace onduleur"><OuiNon name="espace_ond" value={f('espace_onduleur')} onChange={s('espace_onduleur')} /></Field>
      <Field label="Bornier tableau"><OuiNon name="bornier" value={f('bornier_tableau')} onChange={s('bornier_tableau')} /></Field>
      <Field label="Traversée difficile">
        <CheckboxGroup options={['Dalle béton', 'Mur', 'Fondation', 'Vide sanitaire', 'Comble', 'Tranchée']} value={a('traversee_difficile')} onChange={sc('traversee_difficile')} />
      </Field>
      <Field label="Distance panneaux → coffret (m)"><TextInput value={f('distance_panneaux_coffret')} onChange={s('distance_panneaux_coffret')} /></Field>
      <Field label="Distance tableau → onduleur (m)"><TextInput value={f('distance_tableau_onduleur')} onChange={s('distance_tableau_onduleur')} /></Field>
      <Field label="Tube IRO diamètre (mm)">
        <RadioGroup name="tube_iro" options={['16', '20', '25', '32', '40']} value={f('tube_iro_diam')} onChange={s('tube_iro_diam')} />
      </Field>
      <Field label="Gaine diamètre (mm)">
        <RadioGroup name="gaine_diam" options={['16', '20', '25', '32', '40']} value={f('gaine_diam')} onChange={s('gaine_diam')} />
      </Field>
      <Field label="Goulotte couleur">
        <RadioGroup name="goulotte" options={['Alu', 'Blanc', 'Ivoire']} value={f('goulotte_couleur')} onChange={s('goulotte_couleur')} />
      </Field>
      <Field label="Wi-Fi disponible"><OuiNon name="wifi" value={f('wifi')} onChange={s('wifi')} /></Field>
      {f('wifi') === 'Oui' && (
        <Field label="Code Wi-Fi"><TextInput value={f('code_wifi')} onChange={s('code_wifi')} /></Field>
      )}
    </div>
  )
}

export function BToCStep3({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const a = (k: string) => (data[k] as string[]) ?? []
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  const sc = (k: string) => (v: string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Couverture</SectionTitle>
      <Field label="Nature du bâtiment">
        <RadioGroup name="nature_bat" options={['Maison', 'Garage', 'Autre']} value={f('nature_batiment')} onChange={s('nature_batiment')} />
      </Field>
      <Field label="Type de couverture">
        <RadioGroup name="type_couv" options={['Tuiles', 'Fibrociment', 'Bac acier', 'Autre']} value={f('type_couverture')} onChange={s('type_couverture')} />
      </Field>
      <Field label="Obstacles">
        <CheckboxGroup options={['Cheminée', 'Aération', 'Tuile chatière', 'Fenêtre toit', 'Ombrages', 'Autre']} value={a('obstacles')} onChange={sc('obstacles')} />
      </Field>
      <Field label="Type de tuile"><TextInput value={f('type_tuile')} onChange={s('type_tuile')} /></Field>
      <Field label="Fixation tuile">
        <RadioGroup name="fix_tuile" options={['Aucune', 'Collé', 'Fil fer', 'Crochet', 'Autre']} value={f('fixation_tuile')} onChange={s('fixation_tuile')} />
      </Field>
      <Field label="Nature charpente">
        <RadioGroup name="charpente" options={['Fermette', 'Panneaux toiture', 'Chevron', 'Béton']} value={f('nature_charpente')} onChange={s('nature_charpente')} />
      </Field>
      <Field label="Solivages"><OuiNon name="solivages" value={f('solivages')} onChange={s('solivages')} /></Field>
      <Field label="Épaisseur liteaux (mm)"><TextInput value={f('epaisseur_liteaux')} onChange={s('epaisseur_liteaux')} /></Field>
      <Field label="Entraxe (mm)"><TextInput value={f('entraxe')} onChange={s('entraxe')} /></Field>
      <Field label="Solives visibles"><OuiNon name="solives" value={f('solives_visibles')} onChange={s('solives_visibles')} /></Field>
      <Field label="Combles"><OuiNon name="combles" value={f('combles')} onChange={s('combles')} /></Field>
      <Field label="Nature des rives">
        <RadioGroup name="rives" options={['Maçonné', 'Collé', 'Autre']} value={f('nature_rives')} onChange={s('nature_rives')} />
      </Field>
      <Field label="Nature du faîtage">
        <RadioGroup name="faitage" options={['Maçonné', 'Closoir', 'Autre']} value={f('nature_faitage')} onChange={s('nature_faitage')} />
      </Field>
      <Field label="Échafaudage nécessaire"><OuiNon name="echaf" value={f('echafaudage')} onChange={s('echafaudage')} /></Field>
      {f('echafaudage') === 'Oui' && (
        <Field label="Hauteur planchée (m)"><TextInput value={f('hauteur_planchee')} onChange={s('hauteur_planchee')} /></Field>
      )}
      <Field label="Éléments de sécurité"><TextArea value={f('elements_securite')} onChange={s('elements_securite')} /></Field>
    </div>
  )
}

export function BToCStep4({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Calepinage</SectionTitle>
      <Field label="Nature de l'installation">
        <RadioGroup name="nature_install" options={['Intégration', 'Surimposition']} value={f('nature_installation')} onChange={s('nature_installation')} />
      </Field>
      <Field label="Type de fixation">
        <RadioGroup name="type_fix" options={['Esdec tuile', 'Esdec fibrociment', 'K2 Cross Hook', 'K2 Double filetage', 'Dome Solar', 'Fibro Solar']} value={f('type_fixation')} onChange={s('type_fixation')} />
      </Field>
      <Field label="Tuiles en stock"><OuiNon name="tuiles_stock" value={f('tuiles_stock')} onChange={s('tuiles_stock')} /></Field>
      <Field label="Distance bas de pente (m)"><TextInput value={f('dist_bas_pente')} onChange={s('dist_bas_pente')} /></Field>
      <Field label="Distance haut de pente (m)"><TextInput value={f('dist_haut_pente')} onChange={s('dist_haut_pente')} /></Field>
      <Field label="Distance rive gauche (m)"><TextInput value={f('dist_rive_gauche')} onChange={s('dist_rive_gauche')} /></Field>
      <Field label="Distance rive droite (m)"><TextInput value={f('dist_rive_droite')} onChange={s('dist_rive_droite')} /></Field>
      {[1, 2, 3, 4, 5].map(n => (
        <Field key={n} label={`Distance ${n}${n === 1 ? 'ère' : 'ème'} poutre (m)`}>
          <TextInput value={f(`dist_${n}ere_poutre`)} onChange={s(`dist_${n}ere_poutre`)} />
        </Field>
      ))}
      <Field label="Borne de recharge"><OuiNon name="borne" value={f('borne_recharge')} onChange={s('borne_recharge')} /></Field>
      <Field label="Validation calepinage"><OuiNon name="valid_calep" value={f('validation_calepinage')} onChange={s('validation_calepinage')} /></Field>
      {f('validation_calepinage') === 'Non' && (
        <Field label="Raison de non-validation"><TextArea value={f('raison_non_validation')} onChange={s('raison_non_validation')} /></Field>
      )}
      <Field label="Temps estimé"><TextInput value={f('temps_estime')} onChange={s('temps_estime')} /></Field>
      <Field label="Difficultés"><TextArea value={f('difficultes')} onChange={s('difficultes')} /></Field>
    </div>
  )
}

export const BTOC_PHOTO_ZONES = [
  { label: 'Électrique', key: 'electrique' },
  { label: 'Couverture', key: 'couverture' },
]

export function BToCStep5({ data, onChange, vtId }: StepProps & { vtId: string }) {
  return <PhotosStep data={data} onChange={onChange} vtId={vtId} zones={BTOC_PHOTO_ZONES} />
}

// ─── Étapes BtoB ─────────────────────────────────────────────────────────────

export function BToBStep1({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <SectionTitle>Informations générales</SectionTitle>
      <Field label="Nom du projet"><TextInput value={f('nom_projet')} onChange={s('nom_projet')} /></Field>
      <Field label="Adresse du site"><TextInput value={f('adresse_site')} onChange={s('adresse_site')} /></Field>
      <Field label="Nom du client"><TextInput value={f('client_nom')} onChange={s('client_nom')} /></Field>
      <Field label="Contact client"><TextInput value={f('contact_client')} onChange={s('contact_client')} /></Field>
      <Field label="Type de bâtiment"><TextInput value={f('type_batiment')} onChange={s('type_batiment')} /></Field>
      <Field label="Puissance (kWc)"><TextInput value={f('puissance_kwc')} onChange={s('puissance_kwc')} /></Field>
    </div>
  )
}

export function BToBStep2({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const a = (k: string) => (data[k] as string[]) ?? []
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  const sc = (k: string) => (v: string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Couverture</SectionTitle>
      <Field label="Orientation"><TextInput value={f('orientation')} onChange={s('orientation')} /></Field>
      <Field label="Type de couverture">
        <RadioGroup name="type_couv_b2b" options={['Bac acier', 'Fibrociment', 'Tuiles', 'Dalle béton']} value={f('type_couverture')} onChange={s('type_couverture')} />
      </Field>
      <Field label="Complexe d'étanchéité">
        <RadioGroup name="complexe" options={['Graviers', 'PVC', 'Bitume']} value={f('complexe_etancheite')} onChange={s('complexe_etancheite')} />
      </Field>
      <Field label="État de la toiture">
        <CheckboxGroup options={['Fissures', 'Déchirures', 'Mousse/végétation', 'Rétention eau']} value={a('etat_toiture')} onChange={sc('etat_toiture')} />
      </Field>
      <Field label="Longueur du pan (m)"><TextInput value={f('longueur_pan')} onChange={s('longueur_pan')} /></Field>
      <Field label="Largeur du pan (m)"><TextInput value={f('largeur_pan')} onChange={s('largeur_pan')} /></Field>
      <Field label="Entraxes pannes (m)"><TextInput value={f('entraxes_pannes')} onChange={s('entraxes_pannes')} /></Field>
      <Field label="Obstacles"><TextArea value={f('obstacles')} onChange={s('obstacles')} /></Field>
      <Field label="Ombrages"><TextArea value={f('ombrages')} onChange={s('ombrages')} /></Field>
      <Field label="Ondes bac acier (mm)"><TextInput value={f('ondes_bac_acier')} onChange={s('ondes_bac_acier')} /></Field>
      <Field label="Nettoyage nécessaire"><OuiNon name="nettoyage" value={f('nettoyage')} onChange={s('nettoyage')} /></Field>
    </div>
  )
}

export function BToBStep3({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Structure</SectionTitle>
      {([['h_bas_pente', 'H bas de pente (m)'], ['h_faitage', 'H faîtage (m)'], ['h_acrotere', 'H acrotère (m)'], ['l_acrotere', 'L acrotère (m)'], ['l_batiment', 'L bâtiment (m)'], ['larg_batiment', 'Larg. bâtiment (m)']] as [string, string][]).map(([k, label]) => (
        <Field key={k} label={label}><TextInput value={f(k)} onChange={s(k)} /></Field>
      ))}
      <Field label="Type de structure">
        <RadioGroup name="type_struct" options={['Bois', 'Métal', 'Béton', 'Autre']} value={f('type_structure')} onChange={s('type_structure')} />
      </Field>
      <Field label="Type de panne">
        <RadioGroup name="type_panne" options={['H', 'Z', 'Autre']} value={f('type_panne')} onChange={s('type_panne')} />
      </Field>
      <Field label="État de la structure"><TextArea value={f('etat_structure')} onChange={s('etat_structure')} /></Field>
      <Field label="Accès combles"><TextArea value={f('acces_combles')} onChange={s('acces_combles')} /></Field>
    </div>
  )
}

export function BToBStep4({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Électrique</SectionTitle>
      <Field label="Shelter nécessaire"><OuiNon name="shelter_nec" value={f('shelter_necessaire')} onChange={s('shelter_necessaire')} /></Field>
      <Field label="Position logette GRD"><TextInput value={f('position_logette_grd')} onChange={s('position_logette_grd')} /></Field>
      <Field label="Nb PDL"><TextInput value={f('nb_pdl')} onChange={s('nb_pdl')} /></Field>
      <Field label="Type de raccordement">
        <RadioGroup name="type_racc" options={['Mono', 'Triphasé']} value={f('type_raccordement')} onChange={s('type_raccordement')} />
      </Field>
      <Field label="Type de compteur">
        <RadioGroup name="type_cpt" options={['Tarif Bleu', 'Tarif Jaune', 'Tarif Vert']} value={f('type_compteur')} onChange={s('type_compteur')} />
      </Field>
      <Field label="Position compteur"><TextInput value={f('position_compteur')} onChange={s('position_compteur')} /></Field>
      <Field label="Groupe électrogène"><OuiNon name="groupe_elec" value={f('groupe_electrogene')} onChange={s('groupe_electrogene')} /></Field>
      <Field label="Position TGBT"><TextInput value={f('position_tgbt')} onChange={s('position_tgbt')} /></Field>
      <Field label="Distance TGBT (m)"><TextInput value={f('distance_tgbt')} onChange={s('distance_tgbt')} /></Field>
      <Field label="Position baie info"><TextInput value={f('position_baie_info')} onChange={s('position_baie_info')} /></Field>
      <Field label="Position arrêt d'urgence"><TextInput value={f('position_arret_urgence')} onChange={s('position_arret_urgence')} /></Field>
      <Field label="Position onduleurs"><TextInput value={f('position_onduleurs')} onChange={s('position_onduleurs')} /></Field>
      <Field label="Section câbles"><TextInput value={f('section_cables')} onChange={s('section_cables')} /></Field>
      <Field label="Difficulté coupure"><TextInput value={f('difficulte_coupure')} onChange={s('difficulte_coupure')} /></Field>
    </div>
  )
}

export function BToBStep5({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Shelter</SectionTitle>
      <Field label="Position shelter"><TextInput value={f('position_shelter')} onChange={s('position_shelter')} /></Field>
      <Field label="Dalle béton existante"><OuiNon name="dalle" value={f('dalle_beton')} onChange={s('dalle_beton')} /></Field>
      <Field label="État de la dalle"><TextInput value={f('etat_dalle')} onChange={s('etat_dalle')} /></Field>
      <Field label="Dimensions dalle"><TextInput value={f('dim_dalle')} onChange={s('dim_dalle')} /></Field>
      <Field label="Tranchées existantes — nb"><TextInput value={f('tranchees_existantes_nb')} onChange={s('tranchees_existantes_nb')} /></Field>
      <Field label="Tranchées existantes — longueur (m)"><TextInput value={f('tranchees_existantes_longueur')} onChange={s('tranchees_existantes_longueur')} /></Field>
      <Field label="Tranchées à créer — nb"><TextInput value={f('tranchees_creer_nb')} onChange={s('tranchees_creer_nb')} /></Field>
      <Field label="Tranchées à créer — longueur (m)"><TextInput value={f('tranchees_creer_longueur')} onChange={s('tranchees_creer_longueur')} /></Field>
    </div>
  )
}

export function BToBStep6({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const a = (k: string) => (data[k] as string[]) ?? []
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  const sc = (k: string) => (v: string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Sécurité</SectionTitle>
      <Field label="Moyen de levage"><TextInput value={f('moyen_levage')} onChange={s('moyen_levage')} /></Field>
      <Field label="Surface sol"><TextInput value={f('surface_sol')} onChange={s('surface_sol')} /></Field>
      <Field label="Largeur voie (m)"><TextInput value={f('largeur_voie')} onChange={s('largeur_voie')} /></Field>
      <Field label="Zones et notes"><TextArea value={f('zones_notes')} onChange={s('zones_notes')} /></Field>
      <Field label="EPC existant">
        <CheckboxGroup options={['Ligne de vie', 'Potelets', 'Acrotère', 'Gardes-corps']} value={a('epc_existant')} onChange={sc('epc_existant')} />
      </Field>
    </div>
  )
}

export function BToBStep7({ data, onChange }: StepProps) {
  const f = (k: string) => (data[k] as string) ?? ''
  const a = (k: string) => (data[k] as string[]) ?? []
  const s = (k: string) => (v: string) => onChange({ ...data, [k]: v })
  const sc = (k: string) => (v: string[]) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Administratif</SectionTitle>
      <Field label="Panneau DP présent"><OuiNon name="panneau_dp" value={f('presence_panneau_dp')} onChange={s('presence_panneau_dp')} /></Field>
      <Field label="Contraintes">
        <CheckboxGroup options={['ICPE', 'ERP', 'ERT', 'IGH', 'Autre']} value={a('contraintes')} onChange={sc('contraintes')} />
      </Field>
      <Field label="Règles d'accès">
        <CheckboxGroup options={["Horaires d'accès", 'Code portail', 'Fiche présence', 'Autre']} value={a('regles_acces')} onChange={sc('regles_acces')} />
      </Field>
      <Field label="Bureau de contrôle"><TextArea value={f('bureau_controle')} onChange={s('bureau_controle')} /></Field>
      <Field label="Infos MES"><TextArea value={f('info_mes')} onChange={s('info_mes')} /></Field>
      <Field label="Banderole Hellio"><OuiNon name="banderole" value={f('banderole_hellio')} onChange={s('banderole_hellio')} /></Field>
      <Field label="Contacts client"><TextArea value={f('contacts_client')} onChange={s('contacts_client')} /></Field>
      <Field label="Contacts externes"><TextArea value={f('contacts_externes')} onChange={s('contacts_externes')} /></Field>
      <Field label="Documents transmis"><OuiNon name="docs" value={f('documents_transmis')} onChange={s('documents_transmis')} /></Field>
      <Field label="Commentaires"><TextArea value={f('commentaires')} onChange={s('commentaires')} /></Field>
      <Field label="Difficultés"><TextArea value={f('difficultes')} onChange={s('difficultes')} /></Field>
    </div>
  )
}

export const BTOB_PHOTO_ZONES = [
  { label: 'Toiture', key: 'toiture' },
  { label: 'Électrique', key: 'electrique' },
  { label: 'Structure', key: 'structure' },
  { label: 'Général', key: 'general' },
]

export function BToBPhotosStep({ data, onChange, vtId }: StepProps & { vtId: string }) {
  return <PhotosStep data={data} onChange={onChange} vtId={vtId} zones={BTOB_PHOTO_ZONES} />
}
