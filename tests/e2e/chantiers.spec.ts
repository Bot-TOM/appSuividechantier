import { test, expect, Page } from '@playwright/test'

const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL   ?? 'manager.test@pvpilot.fr'
const MANAGER_PWD   = process.env.TEST_MANAGER_PASSWORD ?? 'TestManager2026!'
const TECH_EMAIL    = process.env.TEST_TECH_EMAIL       ?? 'technicien.test@pvpilot.fr'
const TECH_PWD      = process.env.TEST_TECH_PASSWORD    ?? 'TestTech2026!'

// ── Helper login ──────────────────────────────────────────────────────────────
async function loginAs(page: Page, email: string, pwd: string, role: 'manager' | 'technicien') {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(pwd)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(new RegExp(`/${role}`), { timeout: 15000 })
}

// ── Tests Manager — Chantiers ─────────────────────────────────────────────────
test.describe('Manager — Chantiers', () => {

  test('La liste des chantiers contient les données de test', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PWD, 'manager')
    // Clique sur l'onglet Chantiers si présent
    const ongletChantiers = page.getByRole('button', { name: /chantiers/i }).first()
    if (await ongletChantiers.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ongletChantiers.click()
    }
    // Vérifie qu'un chantier de test est visible
    await expect(page.getByText('Installation Dupont')).toBeVisible({ timeout: 10000 })
  })

  test('Manager peut créer un nouveau chantier', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PWD, 'manager')

    // Navigation directe vers le formulaire
    await page.goto('/manager/nouveau-chantier')

    // Ferme la modal de sélection de modèle si elle s'ouvre
    const skipBtn = page.getByRole('button', { name: 'Continuer sans modèle' })
    if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // Remplit le formulaire avec les vrais champs
    await page.locator('input[name="nom"]').fill('Chantier Test Playwright')
    await page.locator('input[name="puissance_kwc"]').fill('6')
    await page.locator('input[name="date_prevue"]').fill('2026-07-01')
    await page.locator('input[name="client_nom"]').fill('Client Test Auto')
    await page.locator('input[name="client_adresse"]').fill('1 rue du Test, 75000 Paris')

    // Soumet le formulaire
    await page.getByRole('button', { name: /créer le chantier/i }).click()

    // Attend la redirection vers /manager exactement (pas /manager/nouveau-chantier)
    await page.waitForURL(url => url.pathname === '/manager', { timeout: 15000 })

    // Clique sur l'onglet Chantiers si visible
    const onglet = page.getByRole('button', { name: /^chantiers$/i })
    if (await onglet.isVisible({ timeout: 3000 }).catch(() => false)) {
      await onglet.click()
    }

    // Vérifie que le chantier créé est visible (on cherche le nom du client, jamais tronqué)
    await expect(page.getByText('Client Test Auto')).toBeVisible({ timeout: 10000 })
  })

})

// ── Tests Technicien ──────────────────────────────────────────────────────────
test.describe('Technicien — Chantiers', () => {

  test('Technicien voit ses chantiers assignés', async ({ page }) => {
    await loginAs(page, TECH_EMAIL, TECH_PWD, 'technicien')
    await expect(page.getByText('Installation Dupont')).toBeVisible({ timeout: 10000 })
  })

  test('Technicien peut ouvrir un chantier et voir les étapes', async ({ page }) => {
    await loginAs(page, TECH_EMAIL, TECH_PWD, 'technicien')
    await page.getByText('Installation Dupont').click()
    // Vérifie qu'on est sur la page du chantier
    await expect(page).toHaveURL(/\/chantier\//, { timeout: 10000 })
    // L'étape "Pose des rails" est visible (statut: fait dans le seed)
    await expect(page.getByText('Pose des rails')).toBeVisible({ timeout: 8000 })
  })

})
