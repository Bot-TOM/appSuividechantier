import { test, expect } from '@playwright/test'

const MANAGER_EMAIL   = process.env.TEST_MANAGER_EMAIL   ?? 'manager.test@pvpilot.fr'
const MANAGER_PWD     = process.env.TEST_MANAGER_PASSWORD ?? 'TestManager2026!'
const TECH_EMAIL      = process.env.TEST_TECH_EMAIL       ?? 'technicien.test@pvpilot.fr'
const TECH_PWD        = process.env.TEST_TECH_PASSWORD    ?? 'TestTech2026!'

// ── Helpers ──────────────────────────────────────────────────────────────────
async function login(page: any, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

// ── Tests connexion ───────────────────────────────────────────────────────────
test.describe('Authentification', () => {

  test('Manager peut se connecter et arrive sur /manager', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PWD)
    await expect(page).toHaveURL(/\/manager/, { timeout: 15000 })
  })

  test('Technicien peut se connecter et arrive sur /technicien', async ({ page }) => {
    await login(page, TECH_EMAIL, TECH_PWD)
    await expect(page).toHaveURL(/\/technicien/, { timeout: 15000 })
  })

  test('Mauvais mot de passe affiche une erreur', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('votre@email.com').fill(MANAGER_EMAIL)
    await page.getByPlaceholder('••••••••').fill('mauvais_mdp')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    // Attend un peu que la réponse revienne
    await page.waitForTimeout(3000)
    // Vérifie qu'on est toujours sur la page login (pas de redirect)
    await expect(page).toHaveURL(/\/login/)
    // Vérifie qu'un message d'erreur rouge est visible
    await expect(page.locator('.bg-red-50').or(page.locator('.text-red-600'))).toBeVisible({ timeout: 5000 })
  })

})
