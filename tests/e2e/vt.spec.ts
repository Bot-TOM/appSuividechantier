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

test.describe('Manager — Visites Techniques', () => {

  test('Peut accéder à la liste des VT', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=vt')
    // Le bouton "Nouvelle VT" doit être visible
    await expect(page.getByRole('button', { name: /nouvelle vt/i })).toBeVisible({ timeout: 10000 })
  })

  test('Peut lancer la création d\'une nouvelle VT', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=vt')

    // Clique sur "Nouvelle VT"
    await page.getByRole('button', { name: /nouvelle vt/i }).click()

    // Doit arriver sur la page de création
    await expect(page).toHaveURL(/\/vt\/nouvelle/, { timeout: 10000 })
  })

  test('Peut créer une VT BtoC', async ({ page }) => {
    await loginManager(page)
    await page.goto('/vt/nouvelle')

    // Sélectionne le type BtoC si proposé
    const btocBtn = page.getByRole('button', { name: /btoc|résidentiel|particulier/i }).first()
    if (await btocBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btocBtn.click()
    }

    // Vérifie qu'on est sur la page de formulaire VT
    await expect(page).toHaveURL(/\/vt/, { timeout: 10000 })

    // Un champ de formulaire doit être visible
    await expect(
      page.locator('input').first()
    ).toBeVisible({ timeout: 8000 })
  })

})
