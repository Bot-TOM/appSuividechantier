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
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl  = process.env.SUPABASE_URL!
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const stripeSecret = process.env.STRIPE_SECRET_KEY!

  // Récupérer le profil
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}&select=entreprise_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const profiles = await profileRes.json() as { entreprise_id?: string }[]
  const entrepriseId = profiles[0]?.entreprise_id
  if (!entrepriseId) {
    return new Response(JSON.stringify({ error: 'Entreprise introuvable' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Récupérer le stripe_customer_id
  const entrepriseRes = await fetch(
    `${supabaseUrl}/rest/v1/entreprises?id=eq.${entrepriseId}&select=stripe_customer_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const entreprises = await entrepriseRes.json() as { stripe_customer_id?: string }[]
  const stripeCustomerId = entreprises[0]?.stripe_customer_id
  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'Aucun abonnement Stripe trouvé' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Créer la session portail Stripe
  const params = new URLSearchParams({
    customer: stripeCustomerId,
    return_url: 'https://chantierpv.fr/manager',
  })
  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(stripeSecret + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!portalRes.ok) {
    const err = await portalRes.json()
    return new Response(JSON.stringify({ error: 'Erreur Stripe', details: err }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const portal = await portalRes.json() as { url: string }
  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
