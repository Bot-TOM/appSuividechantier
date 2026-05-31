import type { ChantierFieldDef } from '@/types'

interface Props {
  fields:    ChantierFieldDef[]            // champs actifs seulement
  values:    Record<string, unknown>
  onChange?: (key: string, value: unknown) => void
  readOnly?: boolean
}

/**
 * Rendu générique des champs personnalisés d'une entreprise.
 * Utilisé en mode saisie (création / édition) et en mode lecture (détail chantier).
 */
export default function CustomFieldsSection({ fields, values, onChange, readOnly = false }: Props) {
  if (fields.length === 0) return null

  // Regroupe par section
  const sections = fields.reduce<Record<string, ChantierFieldDef[]>>((acc, f) => {
    const key = f.section ?? 'Autres'
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white'
  const roValueClass = 'text-sm font-semibold text-gray-800 leading-snug'

  return (
    <>
      {Object.entries(sections).map(([section, sFields]) => (
        <div key={section} className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{section}</h3>

          {sFields.map(field => {
            const val = values[field.field_key]

            if (readOnly) {
              // ── Mode lecture ──────────────────────────────────────────────
              const display = formatValue(field, val)
              if (display === null) return null
              return (
                <div key={field.field_key} className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    {field.field_label}
                  </p>
                  <p className={roValueClass}>{display}</p>
                </div>
              )
            }

            // ── Mode saisie ───────────────────────────────────────────────
            return (
              <div key={field.field_key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.field_label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.field_type === 'textarea' && (
                  <textarea
                    value={String(val ?? '')}
                    onChange={e => onChange?.(field.field_key, e.target.value)}
                    required={field.required}
                    rows={3}
                    className={inputClass + ' resize-none'}
                  />
                )}

                {field.field_type === 'text' && (
                  <input
                    type="text"
                    value={String(val ?? '')}
                    onChange={e => onChange?.(field.field_key, e.target.value)}
                    required={field.required}
                    className={inputClass}
                  />
                )}

                {field.field_type === 'number' && (
                  <input
                    type="number"
                    value={String(val ?? '')}
                    onChange={e => onChange?.(field.field_key, e.target.value === '' ? '' : Number(e.target.value))}
                    required={field.required}
                    step="any"
                    className={inputClass}
                  />
                )}

                {field.field_type === 'date' && (
                  <input
                    type="date"
                    value={String(val ?? '')}
                    onChange={e => onChange?.(field.field_key, e.target.value)}
                    required={field.required}
                    className={inputClass}
                  />
                )}

                {field.field_type === 'select' && (
                  <select
                    value={String(val ?? '')}
                    onChange={e => onChange?.(field.field_key, e.target.value)}
                    required={field.required}
                    className={inputClass}
                  >
                    <option value="">— Choisir —</option>
                    {(field.field_options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.field_type === 'boolean' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={e => onChange?.(field.field_key, e.target.checked)}
                      className="w-5 h-5 rounded accent-orange-500"
                    />
                    <span className="text-sm text-gray-700">Oui</span>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatValue(field: ChantierFieldDef, val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  if (field.field_type === 'boolean') return Boolean(val) ? 'Oui' : 'Non'
  if (field.field_type === 'date' && typeof val === 'string' && val) {
    return new Date(val).toLocaleDateString('fr-FR')
  }
  return String(val)
}
