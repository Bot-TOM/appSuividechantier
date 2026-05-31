import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChantierField {
  field_key:     string
  field_label:   string
  field_type:    'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean'
  field_options: string[] | null
  section:       string | null
  required:      boolean
}

interface VTField {
  key:         string
  label:       string
  type:        'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'boolean' | 'photo'
  options?:    string[] | null
  required?:   boolean
  placeholder?: string
}

interface VTStep {
  key:    string
  label:  string
  fields: VTField[]
}

// ── Prompts ────────────────────────────────────────────────────────────────────
const PROMPT_CHANTIER = `Analyse ce modèle de fiche chantier (secteur photovoltaïque / installation) et extrais tous les champs de formulaire spécifiques à cette entreprise.

RÈGLE : ignore les champs déjà présents dans l'application standard :
- Nom du chantier, Nom du client, Adresse client, Téléphone client
- Type d'installation, Type de contrat, Puissance (kWc), Nombre de panneaux
- Dates de début et de fin, Statut du chantier, Étapes / avancement

Extrais UNIQUEMENT les champs supplémentaires propres à cette entreprise.

Retourne UNIQUEMENT un objet JSON valide (sans markdown) :
{
  "fields": [
    {
      "field_key": "snake_case_unique",
      "field_label": "Libellé",
      "field_type": "text|textarea|number|date|select|boolean",
      "field_options": null,
      "section": "Nom de section ou null",
      "required": false
    }
  ]
}
Si aucun champ détecté, retourne { "fields": [] }.`

const PROMPT_VT = `Analyse ce modèle de visite technique (secteur photovoltaïque) et extrais la structure complète du formulaire : sections (steps) et champs.

Retourne UNIQUEMENT un objet JSON valide (sans markdown) avec ce format exact :
{
  "steps": [
    {
      "key": "step_general",
      "label": "Général",
      "fields": [
        {
          "key": "client_nom",
          "label": "Nom du client",
          "type": "text",
          "options": null,
          "required": true,
          "placeholder": ""
        }
      ]
    }
  ]
}

Types disponibles :
- "text"     : texte court
- "textarea" : texte long (observations, remarques)
- "number"   : valeur numérique (surface, puissance, distance)
- "date"     : date
- "select"   : liste déroulante — renseigner "options" avec le tableau
- "radio"    : choix unique parmi options — renseigner "options"
- "boolean"  : oui / non
- "photo"    : zone de photos (label = nom de la zone)

Regroupe les champs par section logique (step). Chaque section devient une page du formulaire.
Si le document ne contient pas de formulaire identifiable, retourne { "steps": [] }.`

// ── Handler principal ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { file_base64, mime_type, category = 'chantier' } = await req.json() as {
      file_base64: string
      mime_type:   string
      category?:   'chantier' | 'vt'
    }

    if (!file_base64 || !mime_type) {
      return new Response(
        JSON.stringify({ error: 'file_base64 et mime_type sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const isPdf   = mime_type === 'application/pdf'
    const isImage = mime_type.startsWith('image/')
    if (!isPdf && !isImage) {
      return new Response(
        JSON.stringify({ error: 'Type non supporté. Utilisez un PDF ou une image.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const fileContent = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mime_type,          data: file_base64 } }

    const prompt = category === 'vt' ? PROMPT_VT : PROMPT_CHANTIER

    // ── Appel Claude API ───────────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 4096,
        messages:   [{ role: 'user', content: [fileContent, { type: 'text', text: prompt }] }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      console.error('[analyze-template] Anthropic error:', err)
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'analyse IA" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const anthropicData = await anthropicRes.json() as { content: { type: string; text: string }[] }
    const rawText = anthropicData.content?.[0]?.text ?? ''

    // ── Nettoyage et parse ─────────────────────────────────────────────────────
    const clean  = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    let result: { fields?: ChantierField[]; steps?: VTStep[] }

    try {
      result = JSON.parse(clean)
    } catch (e) {
      console.error('[analyze-template] JSON parse error:', e, '\nRaw:', rawText)
      return new Response(
        JSON.stringify({ error: "Impossible de parser la réponse de l'IA", raw: rawText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (category === 'chantier') {
      const fields = (result.fields ?? []).map((f, i) => ({
        field_key:     f.field_key     ?? `champ_${i + 1}`,
        field_label:   f.field_label   ?? `Champ ${i + 1}`,
        field_type:    (['text','textarea','number','date','select','boolean'].includes(f.field_type)
          ? f.field_type : 'text') as ChantierField['field_type'],
        field_options: f.field_type === 'select' ? (f.field_options ?? []) : null,
        section:       f.section ?? null,
        required:      Boolean(f.required),
      }))
      return new Response(JSON.stringify({ fields }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      // VT
      const VALID_VT_TYPES = ['text','textarea','number','date','select','radio','boolean','photo']
      const steps = (result.steps ?? []).map((s, si) => ({
        key:    s.key    ?? `step_${si + 1}`,
        label:  s.label  ?? `Étape ${si + 1}`,
        fields: (s.fields ?? []).map((f, fi) => ({
          key:         f.key         ?? `field_${si}_${fi}`,
          label:       f.label       ?? `Champ ${fi + 1}`,
          type:        VALID_VT_TYPES.includes(f.type) ? f.type : 'text',
          options:     (f.type === 'select' || f.type === 'radio') ? (f.options ?? []) : undefined,
          required:    Boolean(f.required),
          placeholder: f.placeholder ?? undefined,
        })),
      }))
      return new Response(JSON.stringify({ steps }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (err) {
    console.error('[analyze-template] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
