import { useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { VTTemplateStep, VTTemplateField } from '@/types'

interface Props {
  step:     VTTemplateStep
  data:     Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  vtId?:    string   // requis pour l'upload photos
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white'

/** Rend dynamiquement un step d'un template VT. */
export default function DynamicVTStep({ step, data, onChange, vtId }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900">{step.label}</h2>
      {step.fields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={data[field.key]}
          onChange={v => set(field.key, v)}
          vtId={vtId}
          allData={data}
          onAllChange={onChange}
        />
      ))}
    </div>
  )
}

// ── Rendu individuel d'un champ ───────────────────────────────────────────────
function FieldRenderer({
  field, value, onChange, vtId, allData, onAllChange,
}: {
  field:       VTTemplateField
  value:       unknown
  onChange:    (v: unknown) => void
  vtId?:       string
  allData:     Record<string, unknown>
  onAllChange: (d: Record<string, unknown>) => void
}) {
  const { key, label, type, options = [], required, placeholder } = field
  const strVal    = value !== undefined && value !== null ? String(value) : ''

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  switch (type) {
    case 'text':
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={strVal}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className={inputCls}
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          {labelEl}
          <textarea
            value={strVal}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            required={required}
            className={inputCls + ' resize-none'}
          />
        </div>
      )

    case 'number':
      return (
        <div>
          {labelEl}
          <input
            type="number"
            value={strVal}
            onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={placeholder}
            required={required}
            step="any"
            className={inputCls}
          />
        </div>
      )

    case 'date':
      return (
        <div>
          {labelEl}
          <input
            type="date"
            value={strVal}
            onChange={e => onChange(e.target.value)}
            required={required}
            className={inputCls}
          />
        </div>
      )

    case 'select':
      return (
        <div>
          {labelEl}
          <select
            value={strVal}
            onChange={e => onChange(e.target.value)}
            required={required}
            className={inputCls}
          >
            <option value="">— Choisir —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )

    case 'radio':
      return (
        <div>
          {labelEl}
          <div className="flex flex-wrap gap-3">
            {options.map(o => (
              <label key={o} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  value={o}
                  checked={strVal === o}
                  onChange={() => onChange(o)}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-700">{o}</span>
              </label>
            ))}
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div>
          {labelEl}
          <div className="flex gap-3">
            {(['Oui', 'Non'] as const).map(o => (
              <label key={o} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  value={o}
                  checked={strVal === o}
                  onChange={() => onChange(o)}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-700">{o}</span>
              </label>
            ))}
          </div>
        </div>
      )

    case 'photo':
      return (
        <PhotoZone
          zone={key}
          label={label}
          vtId={vtId}
          allData={allData}
          onAllChange={onAllChange}
        />
      )

    default:
      return null
  }
}

// ── Zone photo ────────────────────────────────────────────────────────────────
function PhotoZone({
  zone, label, vtId, allData, onAllChange,
}: {
  zone:        string
  label:       string
  urls?:       string[]
  vtId?:       string
  allData:     Record<string, unknown>
  onAllChange: (d: Record<string, unknown>) => void
}) {
  const fileRef  = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !vtId) return
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `vt/${vtId}/${zone}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vt-photos').upload(path, file)
    if (error) { console.error('[vt-photo] upload:', error); return }
    const { data: { publicUrl } } = supabase.storage.from('vt-photos').getPublicUrl(path)
    const photos = (allData['photos'] as Record<string, string[]> | undefined) ?? {}
    const existing = photos[zone] ?? []
    onAllChange({ ...allData, photos: { ...photos, [zone]: [...existing, publicUrl] } })
    e.target.value = ''
  }

  function removePhoto(url: string) {
    const photos  = (allData['photos'] as Record<string, string[]> | undefined) ?? {}
    const updated = (photos[zone] ?? []).filter(u => u !== url)
    onAllChange({ ...allData, photos: { ...photos, [zone]: updated } })
  }

  // Récupère les URLs stockées dans allData.photos[zone]
  const storedPhotos = ((allData['photos'] as Record<string, string[]> | undefined)?.[zone]) ?? []

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {storedPhotos.map(url => (
          <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
            >×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px]">Photo</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
    </div>
  )
}
