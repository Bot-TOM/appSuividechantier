import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createVisiteTechnique } from '@/hooks/useVisitesTechniques'
import { supabase } from '@/lib/supabase'
import { VTType } from '@/types'
import { ChevronLeft, ChevronRight, Save, CheckCircle, Building, Home } from 'lucide-react'

// ─── Helpers de formulaire ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 resize-none"
    />
  )
}

function RadioGroup({ name, options, value, onChange }: {
  name: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="accent-orange-500"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function CheckboxGroup({ options, value, onChange }: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt])
  }
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="accent-orange-500 rounded"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function OuiNon({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <RadioGroup name={Math.random().toString()} options={['Oui', 'Non']} value={value} onChange={onChange} />
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-gray-900 mb-4 text-base">{children}</h3>
}

// ─── Étapes BtoC ─────────────────────────────────────────────────────────────

function BToCStep1({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
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

function BToCStep2({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const a = (key: string) => (data[key] as string[]) ?? []
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  const sc = (key: string) => (v: string[]) => onChange({ ...data, [key]: v })

  return (
    <div className="space-y-5">
      <SectionTitle>Électrique</SectionTitle>
      <Field label="Abonnement">
        <RadioGroup name="abonnement" options={['Mono', 'Triphasé']} value={f('abonnement')} onChange={s('abonnement')} />
      </Field>
      <Field label="Puissance souscrite">
        <RadioGroup name="puissance_souscrite" options={['3kVA', '6kVA', '9kVA', '12kVA', 'Autre']} value={f('puissance_souscrite')} onChange={s('puissance_souscrite')} />
      </Field>
      <Field label="Disjoncteur différentiel 30mA"><OuiNon value={f('differentiel_30ma')} onChange={s('differentiel_30ma')} /></Field>
      <Field label="Place dans le tableau"><OuiNon value={f('place_tableau')} onChange={s('place_tableau')} /></Field>
      <Field label="Espace onduleur"><OuiNon value={f('espace_onduleur')} onChange={s('espace_onduleur')} /></Field>
      <Field label="Bornier tableau"><OuiNon value={f('bornier_tableau')} onChange={s('bornier_tableau')} /></Field>
      <Field label="Traversée difficile">
        <CheckboxGroup
          options={['Dalle béton', 'Mur', 'Fondation', 'Vide sanitaire', 'Comble', 'Tranchée']}
          value={a('traversee_difficile')}
          onChange={sc('traversee_difficile')}
        />
      </Field>
      <Field label="Distance panneaux → coffret (m)"><TextInput value={f('distance_panneaux_coffret')} onChange={s('distance_panneaux_coffret')} /></Field>
      <Field label="Distance tableau → onduleur (m)"><TextInput value={f('distance_tableau_onduleur')} onChange={s('distance_tableau_onduleur')} /></Field>
      <Field label="Tube IRO diamètre (mm)">
        <RadioGroup name="tube_iro_diam" options={['16', '20', '25', '32', '40']} value={f('tube_iro_diam')} onChange={s('tube_iro_diam')} />
      </Field>
      <Field label="Gaine diamètre (mm)">
        <RadioGroup name="gaine_diam" options={['16', '20', '25', '32', '40']} value={f('gaine_diam')} onChange={s('gaine_diam')} />
      </Field>
      <Field label="Goulotte couleur">
        <RadioGroup name="goulotte_couleur" options={['Alu', 'Blanc', 'Ivoire']} value={f('goulotte_couleur')} onChange={s('goulotte_couleur')} />
      </Field>
      <Field label="Wi-Fi disponible"><OuiNon value={f('wifi')} onChange={s('wifi')} /></Field>
      {f('wifi') === 'Oui' && (
        <Field label="Code Wi-Fi"><TextInput value={f('code_wifi')} onChange={s('code_wifi')} /></Field>
      )}
    </div>
  )
}

function BToCStep3({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const a = (key: string) => (data[key] as string[]) ?? []
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  const sc = (key: string) => (v: string[]) => onChange({ ...data, [key]: v })

  return (
    <div className="space-y-5">
      <SectionTitle>Couverture</SectionTitle>
      <Field label="Nature du bâtiment">
        <RadioGroup name="nature_batiment" options={['Maison', 'Garage', 'Autre']} value={f('nature_batiment')} onChange={s('nature_batiment')} />
      </Field>
      <Field label="Type de couverture">
        <RadioGroup name="type_couverture" options={['Tuiles', 'Fibrociment', 'Bac acier', 'Autre']} value={f('type_couverture')} onChange={s('type_couverture')} />
      </Field>
      <Field label="Obstacles">
        <CheckboxGroup
          options={['Cheminée', 'Aération', 'Tuile chatière', 'Fenêtre toit', 'Ombrages', 'Autre']}
          value={a('obstacles')}
          onChange={sc('obstacles')}
        />
      </Field>
      <Field label="Type de tuile"><TextInput value={f('type_tuile')} onChange={s('type_tuile')} /></Field>
      <Field label="Fixation tuile">
        <RadioGroup name="fixation_tuile" options={['Aucune', 'Collé', 'Fil fer', 'Crochet', 'Autre']} value={f('fixation_tuile')} onChange={s('fixation_tuile')} />
      </Field>
      <Field label="Nature charpente">
        <RadioGroup name="nature_charpente" options={['Fermette', 'Panneaux toiture', 'Chevron', 'Béton']} value={f('nature_charpente')} onChange={s('nature_charpente')} />
      </Field>
      <Field label="Solivages"><OuiNon value={f('solivages')} onChange={s('solivages')} /></Field>
      <Field label="Épaisseur liteaux (mm)"><TextInput value={f('epaisseur_liteaux')} onChange={s('epaisseur_liteaux')} /></Field>
      <Field label="Entraxe (mm)"><TextInput value={f('entraxe')} onChange={s('entraxe')} /></Field>
      <Field label="Solives visibles"><OuiNon value={f('solives_visibles')} onChange={s('solives_visibles')} /></Field>
      <Field label="Combles"><OuiNon value={f('combles')} onChange={s('combles')} /></Field>
      <Field label="Nature des rives">
        <RadioGroup name="nature_rives" options={['Maçonné', 'Collé', 'Autre']} value={f('nature_rives')} onChange={s('nature_rives')} />
      </Field>
      <Field label="Nature du faîtage">
        <RadioGroup name="nature_faitage" options={['Maçonné', 'Closoir', 'Autre']} value={f('nature_faitage')} onChange={s('nature_faitage')} />
      </Field>
      <Field label="Échafaudage nécessaire"><OuiNon value={f('echafaudage')} onChange={s('echafaudage')} /></Field>
      {f('echafaudage') === 'Oui' && (
        <Field label="Hauteur planchée (m)"><TextInput value={f('hauteur_planchee')} onChange={s('hauteur_planchee')} /></Field>
      )}
      <Field label="Éléments de sécurité">
        <TextArea value={f('elements_securite')} onChange={s('elements_securite')} />
      </Field>
    </div>
  )
}

function BToCStep4({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })

  return (
    <div className="space-y-5">
      <SectionTitle>Calepinage</SectionTitle>
      <Field label="Nature de l'installation">
        <RadioGroup name="nature_installation" options={['Intégration', 'Surimposition']} value={f('nature_installation')} onChange={s('nature_installation')} />
      </Field>
      <Field label="Type de fixation">
        <RadioGroup name="type_fixation" options={['Esdec tuile', 'Esdec fibrociment', 'K2 Cross Hook', 'K2 Double filetage', 'Dome Solar', 'Fibro Solar']} value={f('type_fixation')} onChange={s('type_fixation')} />
      </Field>
      <Field label="Tuiles en stock"><OuiNon value={f('tuiles_stock')} onChange={s('tuiles_stock')} /></Field>
      <Field label="Distance bas de pente (m)"><TextInput value={f('dist_bas_pente')} onChange={s('dist_bas_pente')} /></Field>
      <Field label="Distance haut de pente (m)"><TextInput value={f('dist_haut_pente')} onChange={s('dist_haut_pente')} /></Field>
      <Field label="Distance rive gauche (m)"><TextInput value={f('dist_rive_gauche')} onChange={s('dist_rive_gauche')} /></Field>
      <Field label="Distance rive droite (m)"><TextInput value={f('dist_rive_droite')} onChange={s('dist_rive_droite')} /></Field>
      {[1, 2, 3, 4, 5].map(n => (
        <Field key={n} label={`Distance ${n}${n === 1 ? 'ère' : 'ème'} poutre (m)`}>
          <TextInput value={f(`dist_${n}ere_poutre`)} onChange={s(`dist_${n}ere_poutre`)} />
        </Field>
      ))}
      <Field label="Borne de recharge"><OuiNon value={f('borne_recharge')} onChange={s('borne_recharge')} /></Field>
      <Field label="Validation calepinage"><OuiNon value={f('validation_calepinage')} onChange={s('validation_calepinage')} /></Field>
      {f('validation_calepinage') === 'Non' && (
        <Field label="Raison de non-validation">
          <TextArea value={f('raison_non_validation')} onChange={s('raison_non_validation')} />
        </Field>
      )}
      <Field label="Temps estimé"><TextInput value={f('temps_estime')} onChange={s('temps_estime')} /></Field>
      <Field label="Difficultés">
        <TextArea value={f('difficultes')} onChange={s('difficultes')} />
      </Field>
    </div>
  )
}

function BToCStep5({ data, onChange, vtId }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; vtId: string }) {
  const zones = ['Électrique', 'Couverture']
  const photos = (data['photos'] as Record<string, string[]> | undefined) ?? {}
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  async function handleUpload(zone: string, file: File) {
    setUploading(u => ({ ...u, [zone]: true }))
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${vtId}/${zone}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vt-photos').upload(path, file, { upsert: false })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('vt-photos').getPublicUrl(path)
      const prevZonePhotos = photos[zone] ?? []
      const newPhotos = { ...photos, [zone]: [...prevZonePhotos, publicUrl] }
      onChange({ ...data, photos: newPhotos })
    }
    setUploading(u => ({ ...u, [zone]: false }))
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Photos</SectionTitle>
      {zones.map(zone => (
        <div key={zone} className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">{zone}</h4>
          {/* Miniatures */}
          {(photos[zone] ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(photos[zone] ?? []).map((url, i) => (
                <img key={i} src={url} alt={`${zone} ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
              ))}
            </div>
          )}
          {/* Bouton upload */}
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-50 transition-colors w-fit">
            {uploading[zone] ? (
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>+ Ajouter une photo</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading[zone]}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleUpload(zone, file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      ))}
    </div>
  )
}

// ─── Étapes BtoB ─────────────────────────────────────────────────────────────

function BToBStep1({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
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

function BToBStep2({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const a = (key: string) => (data[key] as string[]) ?? []
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  const sc = (key: string) => (v: string[]) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Couverture</SectionTitle>
      <Field label="Orientation"><TextInput value={f('orientation')} onChange={s('orientation')} /></Field>
      <Field label="Type de couverture">
        <RadioGroup name="type_couverture_b2b" options={['Bac acier', 'Fibrociment', 'Tuiles', 'Dalle béton']} value={f('type_couverture')} onChange={s('type_couverture')} />
      </Field>
      <Field label="Complexe d'étanchéité">
        <RadioGroup name="complexe_etancheite" options={['Graviers', 'PVC', 'Bitume']} value={f('complexe_etancheite')} onChange={s('complexe_etancheite')} />
      </Field>
      <Field label="État de la toiture">
        <CheckboxGroup
          options={['Fissures', 'Déchirures', 'Mousse/végétation', 'Rétention eau']}
          value={a('etat_toiture')}
          onChange={sc('etat_toiture')}
        />
      </Field>
      <Field label="Longueur du pan (m)"><TextInput value={f('longueur_pan')} onChange={s('longueur_pan')} /></Field>
      <Field label="Largeur du pan (m)"><TextInput value={f('largeur_pan')} onChange={s('largeur_pan')} /></Field>
      <Field label="Entraxes pannes (m)"><TextInput value={f('entraxes_pannes')} onChange={s('entraxes_pannes')} /></Field>
      <Field label="Obstacles"><TextArea value={f('obstacles')} onChange={s('obstacles')} /></Field>
      <Field label="Ombrages"><TextArea value={f('ombrages')} onChange={s('ombrages')} /></Field>
      <Field label="Ondes bac acier (mm)"><TextInput value={f('ondes_bac_acier')} onChange={s('ondes_bac_acier')} /></Field>
      <Field label="Nettoyage nécessaire"><OuiNon value={f('nettoyage')} onChange={s('nettoyage')} /></Field>
    </div>
  )
}

function BToBStep3({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Structure</SectionTitle>
      {[
        ['h_bas_pente', 'H bas de pente (m)'],
        ['h_faitage', 'H faîtage (m)'],
        ['h_acrotere', 'H acrotère (m)'],
        ['l_acrotere', 'L acrotère (m)'],
        ['l_batiment', 'L bâtiment (m)'],
        ['larg_batiment', 'Larg. bâtiment (m)'],
      ].map(([key, label]) => (
        <Field key={key} label={label}><TextInput value={f(key)} onChange={s(key)} /></Field>
      ))}
      <Field label="Type de structure">
        <RadioGroup name="type_structure" options={['Bois', 'Métal', 'Béton', 'Autre']} value={f('type_structure')} onChange={s('type_structure')} />
      </Field>
      <Field label="Type de panne">
        <RadioGroup name="type_panne" options={['H', 'Z', 'Autre']} value={f('type_panne')} onChange={s('type_panne')} />
      </Field>
      <Field label="État de la structure"><TextArea value={f('etat_structure')} onChange={s('etat_structure')} /></Field>
      <Field label="Accès combles"><TextArea value={f('acces_combles')} onChange={s('acces_combles')} /></Field>
    </div>
  )
}

function BToBStep4({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Électrique</SectionTitle>
      <Field label="Shelter nécessaire"><OuiNon value={f('shelter_necessaire')} onChange={s('shelter_necessaire')} /></Field>
      <Field label="Position logette GRD"><TextInput value={f('position_logette_grd')} onChange={s('position_logette_grd')} /></Field>
      <Field label="Nb PDL"><TextInput value={f('nb_pdl')} onChange={s('nb_pdl')} /></Field>
      <Field label="Type de raccordement">
        <RadioGroup name="type_raccordement" options={['Mono', 'Triphasé']} value={f('type_raccordement')} onChange={s('type_raccordement')} />
      </Field>
      <Field label="Type de compteur">
        <RadioGroup name="type_compteur" options={['Tarif Bleu', 'Tarif Jaune', 'Tarif Vert']} value={f('type_compteur')} onChange={s('type_compteur')} />
      </Field>
      <Field label="Position compteur"><TextInput value={f('position_compteur')} onChange={s('position_compteur')} /></Field>
      <Field label="Groupe électrogène"><OuiNon value={f('groupe_electrogene')} onChange={s('groupe_electrogene')} /></Field>
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

function BToBStep5({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Shelter</SectionTitle>
      <Field label="Position shelter"><TextInput value={f('position_shelter')} onChange={s('position_shelter')} /></Field>
      <Field label="Dalle béton existante"><OuiNon value={f('dalle_beton')} onChange={s('dalle_beton')} /></Field>
      <Field label="État de la dalle"><TextInput value={f('etat_dalle')} onChange={s('etat_dalle')} /></Field>
      <Field label="Dimensions dalle"><TextInput value={f('dim_dalle')} onChange={s('dim_dalle')} /></Field>
      <Field label="Tranchées existantes — nb"><TextInput value={f('tranchees_existantes_nb')} onChange={s('tranchees_existantes_nb')} /></Field>
      <Field label="Tranchées existantes — longueur (m)"><TextInput value={f('tranchees_existantes_longueur')} onChange={s('tranchees_existantes_longueur')} /></Field>
      <Field label="Tranchées à créer — nb"><TextInput value={f('tranchees_creer_nb')} onChange={s('tranchees_creer_nb')} /></Field>
      <Field label="Tranchées à créer — longueur (m)"><TextInput value={f('tranchees_creer_longueur')} onChange={s('tranchees_creer_longueur')} /></Field>
    </div>
  )
}

function BToBStep6({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const a = (key: string) => (data[key] as string[]) ?? []
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  const sc = (key: string) => (v: string[]) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Sécurité</SectionTitle>
      <Field label="Moyen de levage"><TextInput value={f('moyen_levage')} onChange={s('moyen_levage')} /></Field>
      <Field label="Surface sol"><TextInput value={f('surface_sol')} onChange={s('surface_sol')} /></Field>
      <Field label="Largeur voie (m)"><TextInput value={f('largeur_voie')} onChange={s('largeur_voie')} /></Field>
      <Field label="Zones et notes"><TextArea value={f('zones_notes')} onChange={s('zones_notes')} /></Field>
      <Field label="EPC existant">
        <CheckboxGroup
          options={['Ligne de vie', 'Potelets', 'Acrotère', 'Gardes-corps']}
          value={a('epc_existant')}
          onChange={sc('epc_existant')}
        />
      </Field>
    </div>
  )
}

function BToBStep7({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const f = (key: string) => (data[key] as string) ?? ''
  const a = (key: string) => (data[key] as string[]) ?? []
  const s = (key: string) => (v: string) => onChange({ ...data, [key]: v })
  const sc = (key: string) => (v: string[]) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-5">
      <SectionTitle>Administratif</SectionTitle>
      <Field label="Panneau DP présent"><OuiNon value={f('presence_panneau_dp')} onChange={s('presence_panneau_dp')} /></Field>
      <Field label="Contraintes">
        <CheckboxGroup
          options={['ICPE', 'ERP', 'ERT', 'IGH', 'Autre']}
          value={a('contraintes')}
          onChange={sc('contraintes')}
        />
      </Field>
      <Field label="Règles d'accès">
        <CheckboxGroup
          options={["Horaires d'accès", 'Code portail', 'Fiche présence', 'Autre']}
          value={a('regles_acces')}
          onChange={sc('regles_acces')}
        />
      </Field>
      <Field label="Bureau de contrôle"><TextArea value={f('bureau_controle')} onChange={s('bureau_controle')} /></Field>
      <Field label="Infos MES"><TextArea value={f('info_mes')} onChange={s('info_mes')} /></Field>
      <Field label="Banderole Hellio"><OuiNon value={f('banderole_hellio')} onChange={s('banderole_hellio')} /></Field>
      <Field label="Contacts client"><TextArea value={f('contacts_client')} onChange={s('contacts_client')} /></Field>
      <Field label="Contacts externes"><TextArea value={f('contacts_externes')} onChange={s('contacts_externes')} /></Field>
      <Field label="Documents transmis"><OuiNon value={f('documents_transmis')} onChange={s('documents_transmis')} /></Field>
      <Field label="Commentaires"><TextArea value={f('commentaires')} onChange={s('commentaires')} /></Field>
      <Field label="Difficultés"><TextArea value={f('difficultes')} onChange={s('difficultes')} /></Field>
    </div>
  )
}

// ─── Page principale VTCreate ─────────────────────────────────────────────────

export default function VTCreate() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [vtType, setVtType] = useState<VTType | null>(null)
  const [vtId, setVtId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save avec debounce 1500ms
  const scheduleAutoSave = useCallback((data: Record<string, unknown>, id: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      await supabase
        .from('visites_techniques')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('id', id)
      setSaving(false)
    }, 1500)
  }, [])

  useEffect(() => {
    if (vtId && step > 0) {
      scheduleAutoSave(formData, vtId)
    }
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current) }
  }, [formData, vtId, step, scheduleAutoSave])

  async function handleTypeSelect(type: VTType) {
    if (!profile?.id || creating) return
    setCreating(true)
    const id = await createVisiteTechnique(type, profile.id)
    if (!id) { setCreating(false); return }
    setVtType(type)
    setVtId(id)
    setStep(1)
    setCreating(false)
  }

  function handleDataChange(data: Record<string, unknown>) {
    setFormData(data)
    // Sync client_nom et client_adresse sur la VT pour la liste
    if (vtId) {
      const updates: Record<string, unknown> = { data, updated_at: new Date().toISOString() }
      if (data['client_nom']) updates['client_nom'] = data['client_nom']
      if (data['client_adresse']) updates['client_adresse'] = data['client_adresse'] ?? data['adresse_site']
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(async () => {
        setSaving(true)
        await supabase.from('visites_techniques').update(updates).eq('id', vtId)
        setSaving(false)
      }, 1500)
    }
  }

  async function handleFinish() {
    if (!vtId) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    await supabase.from('visites_techniques').update({
      data: formData,
      statut: 'complete',
      client_nom: (formData['client_nom'] as string) ?? null,
      client_adresse: (formData['client_adresse'] as string ?? formData['adresse_site'] as string) ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', vtId)
    setSaving(false)
    navigate(`/vt/${vtId}`)
  }

  // Étapes BtoC
  const btocSteps = [
    { label: 'Général', component: <BToCStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToCStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToCStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Calepinage', component: <BToCStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Photos', component: <BToCStep5 data={formData} onChange={handleDataChange} vtId={vtId ?? ''} /> },
  ]

  // Étapes BtoB
  const btobSteps = [
    { label: 'Général', component: <BToBStep1 data={formData} onChange={handleDataChange} /> },
    { label: 'Couverture', component: <BToBStep2 data={formData} onChange={handleDataChange} /> },
    { label: 'Structure', component: <BToBStep3 data={formData} onChange={handleDataChange} /> },
    { label: 'Électrique', component: <BToBStep4 data={formData} onChange={handleDataChange} /> },
    { label: 'Shelter', component: <BToBStep5 data={formData} onChange={handleDataChange} /> },
    { label: 'Sécurité', component: <BToBStep6 data={formData} onChange={handleDataChange} /> },
    { label: 'Admin', component: <BToBStep7 data={formData} onChange={handleDataChange} /> },
  ]

  const steps = vtType === 'btoc' ? btocSteps : btobSteps
  const currentStep = step > 0 ? steps[step - 1] : null
  const isLastStep = step > 0 && step === steps.length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { if (step > 1) setStep(s => s - 1); else navigate('/manager') }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{step > 1 ? 'Précédent' : 'Retour'}</span>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-slate-900 text-base">
              {step === 0 ? 'Nouvelle Visite Technique' : `${vtType === 'btoc' ? 'BtoC' : 'BtoB'} — ${currentStep?.label}`}
            </h1>
            {step > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">Étape {step} / {steps.length}</p>
            )}
          </div>
          {saving ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </div>
          ) : step > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Save className="w-3.5 h-3.5" />
              Sauvegardé
            </div>
          ) : <div className="w-24" />}
        </div>

        {/* Barre de progression */}
        {step > 0 && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-3">
            <div className="flex gap-1">
              {steps.map((_s, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-colors ${i < step ? 'bg-orange-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Étape 0 : choix du type */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Quel type de visite ?</h2>
              <p className="text-slate-500 text-sm">Choisissez le contexte de la visite technique</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleTypeSelect('btoc')}
                disabled={creating}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-left hover:shadow-md hover:border-purple-200 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                  <Home className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">BtoC</h3>
                <p className="text-sm text-slate-500">Résidentiel — Particuliers</p>
                <p className="text-xs text-slate-400 mt-2">5 étapes</p>
              </button>

              <button
                onClick={() => handleTypeSelect('btob')}
                disabled={creating}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-left hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1">BtoB</h3>
                <p className="text-sm text-slate-500">Professionnel — Entreprises</p>
                <p className="text-xs text-slate-400 mt-2">7 étapes</p>
              </button>
            </div>
            {creating && (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-4">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Création en cours...
              </div>
            )}
          </div>
        )}

        {/* Étapes de formulaire */}
        {step > 0 && currentStep && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
            {currentStep.component}

            {/* Navigation bas */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>

              {isLastStep ? (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Terminer
                </button>
              ) : (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
