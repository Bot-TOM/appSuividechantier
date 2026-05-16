export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
}

/** Vérifie la signature Stripe via HMAC-SHA256 avec WebCrypto */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    // Le header stripe-signature ressemble à : t=timestamp,v1=hash,...
    const parts = sigHeader.split(',')
    const tPart = parts.find((p) => p.startsWith('t='))
    const v1Part = parts.find((p) => p.startsWith('v1='))

    if (!tPart || !v1Part) return false

    const timestamp = tPart.slice(2)
    const expectedSig = v1Part.slice(3)

    const signedPayload = `${timestamp}.${payload}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
    const computedSig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return computedSig === expectedSig
  } catch {
    return false
  }
}

async function updateEntreprise(
  supabaseUrl: string,
  serviceKey: string,
  entrepriseId: string,
  updates: Record<string, string | null>
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/entreprises?id=eq.${entrepriseId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: 'STRIPE_WEBHOOK_SECRET manquant' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sigHeader = req.headers.get('stripe-signature') ?? ''
  const rawBody = await req.text()

  const isValid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret)
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Signature Stripe invalide' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const event = JSON.parse(rawBody) as {
    type: string
    data: { object: Record<string, unknown> }
  }

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string
        status: string
        metadata?: { entreprise_id?: string }
        client_reference_id?: string
      }
      const entrepriseId =
        sub.metadata?.entreprise_id ?? (sub.client_reference_id as string | undefined)

      if (entrepriseId && sub.status === 'active') {
        await updateEntreprise(supabaseUrl, serviceKey, entrepriseId, {
          plan: 'pro',
          stripe_subscription_id: sub.id,
          stripe_subscription_status: 'active',
        })
      } else if (entrepriseId) {
        await updateEntreprise(supabaseUrl, serviceKey, entrepriseId, {
          stripe_subscription_id: sub.id,
          stripe_subscription_status: sub.status,
        })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as {
        id: string
        metadata?: { entreprise_id?: string }
        client_reference_id?: string
      }
      const entrepriseId =
        sub.metadata?.entreprise_id ?? (sub.client_reference_id as string | undefined)

      if (entrepriseId) {
        await updateEntreprise(supabaseUrl, serviceKey, entrepriseId, {
          plan: 'starter',
          stripe_subscription_status: 'canceled',
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        subscription?: string
        customer?: string
      }

      // Trouver l'entreprise via stripe_subscription_id
      if (invoice.subscription) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/entreprises?stripe_subscription_id=eq.${invoice.subscription}&select=id`,
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
          }
        )
        if (res.ok) {
          const rows = await res.json() as { id: string }[]
          if (rows[0]?.id) {
            await updateEntreprise(supabaseUrl, serviceKey, rows[0].id, {
              stripe_subscription_status: 'past_due',
            })
          }
        }
      }
      break
    }

    default:
      // Événement non géré — on répond 200 pour éviter les rejeux Stripe
      break
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
