export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

const WELCOME_HTML = (fullName: string) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue sur ChantierPV</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#EA580C 0%,#F97316 60%,#FB923C 100%);border-radius:20px 20px 0 0;padding:40px 40px 32px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:16px;padding:12px 18px;margin-bottom:20px;">
                <span style="font-size:32px;">☀️</span>
              </div>
              <h1 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">ChantierPV</h1>
              <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">Suivi de chantier photovoltaïque</p>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#fff;padding:40px 40px 32px;">

              <!-- Badge -->
              <div style="text-align:center;margin-bottom:24px;">
                <span style="display:inline-block;background:#F0FDF4;color:#16A34A;font-size:12px;font-weight:700;padding:6px 16px;border-radius:999px;border:1px solid #BBF7D0;letter-spacing:0.5px;text-transform:uppercase;">
                  🎉 &nbsp;Compte activé
                </span>
              </div>

              <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:800;text-align:center;line-height:1.3;">
                Bienvenue ${fullName.split(' ')[0]} !
              </h2>
              <p style="margin:0 0 28px;color:#6B7280;font-size:15px;text-align:center;line-height:1.6;">
                Votre espace entreprise est prêt. Voici comment démarrer en 3 étapes.
              </p>

              <!-- STEPS -->
              <!-- Step 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:42px;height:42px;background:linear-gradient(135deg,#EA580C,#F97316);border-radius:12px;text-align:center;line-height:42px;color:#fff;font-size:16px;font-weight:800;">1</div>
                  </td>
                  <td style="padding-left:14px;" valign="middle">
                    <p style="margin:0 0 2px;color:#111827;font-size:14px;font-weight:700;">Créez votre premier chantier</p>
                    <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Ajoutez l'adresse, le type d'installation, la date prévue et les panneaux.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:42px;height:42px;background:linear-gradient(135deg,#EA580C,#F97316);border-radius:12px;text-align:center;line-height:42px;color:#fff;font-size:16px;font-weight:800;">2</div>
                  </td>
                  <td style="padding-left:14px;" valign="middle">
                    <p style="margin:0 0 2px;color:#111827;font-size:14px;font-weight:700;">Invitez vos techniciens</p>
                    <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Depuis "Gestion d'équipe", créez leurs comptes en quelques secondes.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48" valign="top">
                    <div style="width:42px;height:42px;background:linear-gradient(135deg,#EA580C,#F97316);border-radius:12px;text-align:center;line-height:42px;color:#fff;font-size:16px;font-weight:800;">3</div>
                  </td>
                  <td style="padding-left:14px;" valign="middle">
                    <p style="margin:0 0 2px;color:#111827;font-size:14px;font-weight:700;">Testez le rapport vocal IA</p>
                    <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Dictez un compte-rendu depuis le terrain, l'IA le rédige pour vous.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="https://chantierpv.fr/manager"
                   style="display:inline-block;background:linear-gradient(135deg,#EA580C 0%,#F97316 100%);color:#fff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:14px;text-decoration:none;box-shadow:0 6px 20px rgba(249,115,22,0.4);">
                  Accéder à mon espace →
                </a>
              </div>

              <hr style="border:none;border-top:1px solid #F3F4F6;margin:0 0 28px;" />

              <!-- TIPS BANNER -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%);border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <p style="margin:0 0 10px;color:#EA580C;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">💡 Le saviez-vous ?</p>
                    <p style="margin:0;color:#9A3412;font-size:13px;line-height:1.6;">
                      Vos techniciens n'ont <strong>pas besoin de créer un compte eux-mêmes</strong> — vous le faites pour eux depuis votre espace manager. Ils reçoivent leurs identifiants par email.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- HELP -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:14px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#111827;font-size:14px;font-weight:700;">💬 On est là si vous avez besoin</p>
                    <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">
                      Une question, un bug, une suggestion ? Écrivez-nous à <a href="mailto:contact@chantierpv.fr" style="color:#EA580C;font-weight:600;text-decoration:none;">contact@chantierpv.fr</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F9FAFB;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 8px;color:#111827;font-size:13px;font-weight:700;">☀️ ChantierPV</p>
              <p style="margin:0 0 12px;color:#9CA3AF;font-size:12px;">Le suivi de chantier PV fait pour le terrain</p>
              <p style="margin:0;color:#D1D5DB;font-size:11px;">
                <a href="https://chantierpv.fr/cgu" style="color:#D1D5DB;text-decoration:none;">CGU</a>
                &nbsp;·&nbsp;
                <a href="https://chantierpv.fr/confidentialite" style="color:#D1D5DB;text-decoration:none;">Confidentialité</a>
                &nbsp;·&nbsp;
                <a href="https://chantierpv.fr" style="color:#D1D5DB;text-decoration:none;">chantierpv.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Vérification JWT
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Clé Resend manquante' }), { status: 500 })
  }

  let fullName = 'là'
  let email = ''
  try {
    const body = await req.json() as { full_name?: string; email?: string }
    fullName = body.full_name?.trim() || 'là'
    email = body.email?.trim() || ''
  } catch {
    return new Response(JSON.stringify({ error: 'Body invalide' }), { status: 400 })
  }

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email manquant' }), { status: 400 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'ChantierPV <contact@chantierpv.fr>',
      to: [email],
      subject: '🎉 Votre espace ChantierPV est prêt !',
      html: WELCOME_HTML(fullName),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: 'Erreur envoi email', detail: err }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
