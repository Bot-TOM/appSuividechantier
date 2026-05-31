import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// ── Types ──────────────────────────────────────────────────────────────────────
interface FieldDef {
  field_key:     string
  field_label:   string
  field_type:    'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean'
  field_options: string[] | null
  section:       string | null
  required:      boolean
}

// ── Handler ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { file_base64, mime_type } = await req.json() as {
      file_base64: string
      mime_type:   string
    }

    if (!file_base64 || !mime_type) {
      return new Response(
        JSON.stringify({ error: 'file_base64 et mime_type sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Détermine le type de contenu pour Claude ───────────────────────────────
    const isPdf   = mime_type === 'application/pdf'
    const isImage = mime_type.startsWith('image/')

    if (!isPdf && !isImage) {
      return new Response(
        JSON.stringify({ error: 'Type de fichier non supporté. Utilisez un PDF ou une image.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const fileContent = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mime_type,          data: file_base64 } }

    const prompt = `Analyse ce modèle de fiche chantier (secteur photovoltaïque / installation) et extrais tous les champs de formulaire spécifiques à cette entreprise.

RÈGLE : ignore les champs déjà présents dans l'application standard :
- Nom du chantier, Nom du client, Adresse client, Téléphone client
- Type d'installation, Type de contrat
- Puissance (kWc), Nombre de panneaux
- Dates de début et de fin
- Statut du chantier
- Étapes / avancement

Extrais UNIQUEMENT les champs supplémentaires propres à cette entreprise (références internes, données techniques spécifiques, informations administratives, observations particulières, etc.).

Retourne UNIQUEMENT un objet JSON valide (sans markdown, sans code block) avec ce format exact :
{
  "fields": [
    {
      "field_key": "identifiant_unique_snake_case",
      "field_label": "Libellé affiché à l'utilisateur",
      "field_type": "text",
      "field_options": null,
      "section": "Nom de la section",
      "required": false
    }
  ]
}

Types disponibles pour field_type :
- "text"     : texte court (référence, nom, téléphone…)
- "textarea" : texte long (observations, remarques, description…)
- "number"   : valeur numérique (quantité, surface, prix…)
- "date"     : date
- "select"   : choix parmi une liste — dans ce cas, remplis field_options avec le tableau des options
- "boolean"  : oui/non (case à cocher)

Si le fichier ne contient pas de champs identifiables, retourne { "fields": [] }.`

    // ── Appel Claude API ───────────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-api-key':        ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 2048,
        messages:   [{
          role:    'user',
          content: [fileContent, { type: 'text', text: prompt }],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      console.error('[analyze-template] Anthropic error:', err)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'analyse IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const anthropicData = await anthropicRes.json() as {
      content: { type: string; text: string }[]
    }
    const rawText = anthropicData.content?.[0]?.text ?? ''

    // ── Parse du JSON retourné par Claude ──────────────────────────────────────
    let fields: FieldDef[] = []
    try {
      // Claude peut parfois entourer le JSON de backticks — on nettoie
      const clean = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
      const parsed = JSON.parse(clean) as { fields: FieldDef[] }
      fields = (parsed.fields ?? []).map((f, i) => ({
        field_key:     f.field_key     ?? `champ_${i + 1}`,
        field_label:   f.field_label   ?? `Champ ${i + 1}`,
        field_type:    (['text','textarea','number','date','select','boolean'].includes(f.field_type)
          ? f.field_type : 'text') as FieldDef['field_type'],
        field_options: f.field_type === 'select' ? (f.field_options ?? []) : null,
        section:       f.section ?? null,
        required:      Boolean(f.required),
      }))
    } catch (e) {
      console.error('[analyze-template] JSON parse error:', e, '\nRaw:', rawText)
      return new Response(
        JSON.stringify({ error: 'Impossible de parser la réponse de l\'IA', raw: rawText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ fields }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('[analyze-template] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
