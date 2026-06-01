import { test, expect, Page } from '@playwright/test'

const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL    ?? 'manager.test@pvpilot.fr'
const MANAGER_PWD   = process.env.TEST_MANAGER_PASSWORD ?? 'TestManager2026!'

async function loginManager(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(MANAGER_EMAIL)
  await page.getByPlaceholder('••••••••').fill(MANAGER_PWD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/manager/, { timeout: 15000 })
}

test.describe('Manager — Équipe', () => {

  test('Peut voir la liste des techniciens', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=equipe')
    // Sam Technicien (seed) doit apparaître
    await expect(page.getByText('Sam Technicien')).toBeVisible({ timeout: 10000 })
  })

  test('Le bouton "Nouveau technicien" est disponible', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=equipe')
    await expect(
      page.getByRole('button', { name: /nouveau technicien/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('Le formulaire de création de technicien s\'ouvre', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=equipe')

    await page.getByRole('button', { name: /nouveau technicien/i }).click()

    // Les champs du formulaire apparaissent
    await expect(page.getByPlaceholder('Paul Martin')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('paul@entreprise.com')).toBeVisible({ timeout: 3000 })
  })

})
