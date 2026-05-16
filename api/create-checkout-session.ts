import { verifyAuth } from './_auth'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Vérification auth
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { userId } = auth

  // Récupérer le profil depuis Supabase
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=email,entreprise_id`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )

  if (!profileRes.ok) {
    return new Response(JSON.stringify({ error: 'Impossible de récupérer le profil' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const profiles = await profileRes.json() as { email?: string; entreprise_id?: string }[]
  const profile = profiles[0]

  if (!profile?.entreprise_id) {
    return new Response(JSON.stringify({ error: 'Entreprise introuvable' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { entreprise_id, email } = profile

  // Récupérer le stripe_customer_id existant si présent
  const entrepriseRes = await fetch(
    `${supabaseUrl}/rest/v1/entreprises?id=eq.${entreprise_id}&select=stripe_customer_id`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )

  let stripeCustomerId: string | undefined
  if (entrepriseRes.ok) {
    const entreprises = await entrepriseRes.json() as { stripe_customer_id?: string }[]
    stripeCustomerId = entreprises[0]?.stripe_customer_id ?? undefined
  }

  // Créer la session Stripe Checkout
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY!
  const priceId = process.env.STRIPE_PRICE_ID_PRO!

  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: 'https://chantierpv.fr/upgrade/success',
    cancel_url: 'https://chantierpv.fr',
    client_reference_id: entreprise_id,
    'subscription_data[metadata][entreprise_id]': entreprise_id,
  }

  if (stripeCustomerId) {
    params.customer = stripeCustomerId
  } else if (email) {
    params.customer_email = email
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(stripeSecretKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })

  if (!stripeRes.ok) {
    const err = await stripeRes.json()
    return new Response(JSON.stringify({ error: 'Erreur Stripe', details: err }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const session = await stripeRes.json() as { url: string }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
