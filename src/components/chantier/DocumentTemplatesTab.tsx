import { useState } from 'react'
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates'
import ChantierTemplateEditor from '@/components/chantier/ChantierTemplateEditor'
import VTTemplateEditor from '@/components/vt/VTTemplateEditor'
import type { DocumentTemplate, VTTemplateData, VTTemplateStep, ChantierTemplateData } from '@/types'
import type { ChantierDraftField } from '@/components/chantier/ChantierTemplateEditor'
import { Plus, Pencil, Trash2, Star, ClipboardList, FileText } from 'lucide-react'

interface Props {
  entrepriseId: string
}

// ── Carte générique d'un template ─────────────────────────────────────────────
function TemplateCard({
  template, fieldCount, onEdit, onDelete, onSetDefault,
}: {
  template:    DocumentTemplate
  fieldCount:  string   // ex: "4 champs" ou "3 sections · 12 champs"
  onEdit:      () => void
  onDelete:    () => void
  onSetDefault:() => void
}) {
  return (
    <div
      className={`bg-white rounded-2xl border transition-all overflow-hidden ${template.is_default ? 'border-orange-300' : 'border-gray-100'}`}
      style={{ boxShadow: template.is_default ? '0 0 0 1px rgba(249,115,22,0.25), 0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm truncate">{template.name}</p>
              {template.is_default && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <Star className="w-2.5 h-2.5" /> Défaut
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{template.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{fieldCount}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!template.is_default && (
              <button onClick={onSetDefault} title="Définir comme défaut"
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onEdit} title="Modifier"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} title="Supprimer"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section Fiches chantier ───────────────────────────────────────────────────
function ChantierTemplatesSection({ entrepriseId }: { entrepriseId: string }) {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, setDefault } =
    useDocumentTemplates(entrepriseId, 'chantier')

  type Mode = 'list' | 'new' | { id: string }
  const [mode,      setMode]      = useState<Mode>('list')
  const [nameInput, setNameInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [saving,    setSaving]    = useState(false)

  const editingTemplate = typeof mode === 'object' ? templates.find(t => t.id === mode.id) : null

  async function handleSave(fields: ChantierDraftField[]) {
    setSaving(true)
    if (mode === 'new') {
      await createTemplate({
        entreprise_id: entrepriseId,
        category:      'chantier',
        name:          nameInput.trim() || 'Nouveau modèle chantier',
        description:   descInput.trim() || null,
        template_data: { fields },
        is_default:    templates.length === 0,
        position:      templates.length,
      })
    } else if (typeof mode === 'object') {
      await updateTemplate(mode.id, {
        name:          nameInput.trim() || editingTemplate?.name,
        description:   descInput.trim() || null,
        template_data: { fields },
      })
    }
    setSaving(false)
    setMode('list')
    setNameInput('')
    setDescInput('')
  }

  function startNew() { setNameInput(''); setDescInput(''); setMode('new') }
  function startEdit(tpl: DocumentTemplate) {
    setNameInput(tpl.name)
    setDescInput(tpl.description ?? '')
    setMode({ id: tpl.id })
  }

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (mode === 'new' || typeof mode === 'object') {
    const initial = typeof mode === 'object'
      ? ((editingTemplate?.template_data as ChantierTemplateData)?.fields ?? [])
      : []
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom du modèle *</label>
            <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Ex: Fiche résidentiel"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optionnel)</label>
            <input type="text" value={descInput} onChange={e => setDescInput(e.target.value)}
              placeholder="Courte description…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <ChantierTemplateEditor
          initialFields={initial as ChantierDraftField[]}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setNameInput(''); setDescInput('') }}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {templates.length === 0
            ? 'Aucun modèle — créez-en un ou importez une fiche existante.'
            : `${templates.length} modèle${templates.length > 1 ? 's' : ''} configuré${templates.length > 1 ? 's' : ''}`}
        </p>
        <button onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Nouveau modèle
        </button>
      </div>

      {templates.length === 0 && (
        <button onClick={startNew}
          className="w-full flex flex-col items-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-orange-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Créer votre premier modèle de fiche chantier</p>
            <p className="text-xs text-gray-400 mt-0.5">Importez un PDF ou construisez manuellement</p>
          </div>
        </button>
      )}

      <div className="space-y-2">
        {templates.map(tpl => {
          const f = (tpl.template_data as ChantierTemplateData).fields ?? []
          const count = `${f.length} champ${f.length > 1 ? 's' : ''}`
          return (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              fieldCount={count}
              onEdit={() => startEdit(tpl)}
              onDelete={() => {
                if (confirm(`Supprimer le modèle "${tpl.name}" ? Les chantiers existants ne seront pas affectés.`))
                  deleteTemplate(tpl.id)
              }}
              onSetDefault={() => setDefault(tpl.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Section Visites techniques ────────────────────────────────────────────────
function VTTemplatesSection({ entrepriseId }: { entrepriseId: string }) {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, setDefault } =
    useDocumentTemplates(entrepriseId, 'vt')

  type Mode = 'list' | 'new' | { id: string }
  const [mode,      setMode]      = useState<Mode>('list')
  const [nameInput, setNameInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [saving,    setSaving]    = useState(false)

  const editingTemplate = typeof mode === 'object' ? templates.find(t => t.id === mode.id) : null

  async function handleSave(steps: VTTemplateStep[]) {
    setSaving(true)
    if (mode === 'new') {
      await createTemplate({
        entreprise_id: entrepriseId,
        category:      'vt',
        name:          nameInput.trim() || 'Nouveau modèle VT',
        description:   descInput.trim() || null,
        template_data: { steps },
        is_default:    templates.length === 0,
        position:      templates.length,
      })
    } else if (typeof mode === 'object') {
      await updateTemplate(mode.id, {
        name:          nameInput.trim() || editingTemplate?.name,
        description:   descInput.trim() || null,
        template_data: { steps },
      })
    }
    setSaving(false)
    setMode('list')
    setNameInput('')
    setDescInput('')
  }

  function startNew() { setNameInput(''); setDescInput(''); setMode('new') }
  function startEdit(tpl: DocumentTemplate) {
    setNameInput(tpl.name)
    setDescInput(tpl.description ?? '')
    setMode({ id: tpl.id })
  }

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (mode === 'new' || typeof mode === 'object') {
    const initial = typeof mode === 'object' ? (editingTemplate?.template_data as VTTemplateData)?.steps : []
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom du modèle *</label>
            <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Ex: VT Résidentiel"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optionnel)</label>
            <input type="text" value={descInput} onChange={e => setDescInput(e.target.value)}
              placeholder="Courte description…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <VTTemplateEditor
          initialSteps={initial}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setNameInput(''); setDescInput('') }}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {templates.length === 0
            ? 'Aucun modèle VT — créez-en un ou importez un document existant.'
            : `${templates.length} modèle${templates.length > 1 ? 's' : ''} configuré${templates.length > 1 ? 's' : ''}`}
        </p>
        <button onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Nouveau modèle
        </button>
      </div>

      {templates.length === 0 && (
        <button onClick={startNew}
          className="w-full flex flex-col items-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-blue-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Créer votre premier modèle VT</p>
            <p className="text-xs text-gray-400 mt-0.5">Importez un PDF ou construisez manuellement</p>
          </div>
        </button>
      )}

      <div className="space-y-2">
        {templates.map(tpl => {
          const steps = (tpl.template_data as VTTemplateData).steps ?? []
          const totalFields = steps.reduce((s, st) => s + st.fields.length, 0)
          return (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              fieldCount={`${steps.length} section${steps.length > 1 ? 's' : ''} · ${totalFields} champ${totalFields > 1 ? 's' : ''}`}
              onEdit={() => startEdit(tpl)}
              onDelete={() => {
                if (confirm(`Supprimer le modèle "${tpl.name}" ? Les VT existantes ne seront pas affectées.`))
                  deleteTemplate(tpl.id)
              }}
              onSetDefault={() => setDefault(tpl.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function DocumentTemplatesTab({ entrepriseId }: Props) {
  const [activeTab, setActiveTab] = useState<'chantier' | 'vt'>('chantier')

  const tabs = [
    { key: 'chantier' as const, label: 'Fiches chantier',    Icon: FileText      },
    { key: 'vt'       as const, label: 'Visites techniques', Icon: ClipboardList },
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-gray-900">Modèles de documents</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configurez vos modèles personnalisés. Ils seront disponibles à la création de chaque document.
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'chantier' && <ChantierTemplatesSection entrepriseId={entrepriseId} />}
      {activeTab === 'vt'       && <VTTemplatesSection       entrepriseId={entrepriseId} />}
    </div>
  )
}
