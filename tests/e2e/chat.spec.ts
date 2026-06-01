import { test, expect, Page } from '@playwright/test'

const TECH_EMAIL = process.env.TEST_TECH_EMAIL    ?? 'technicien.test@pvpilot.fr'
const TECH_PWD   = process.env.TEST_TECH_PASSWORD ?? 'TestTech2026!'
const CHANTIER_1 = 'bbbbbbbb-0000-0000-0000-000000000001'

async function loginTech(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(TECH_EMAIL)
  await page.getByPlaceholder('••••••••').fill(TECH_PWD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/technicien/, { timeout: 15000 })
}

test.describe('Chat', () => {

  test('Peut accéder au chat d\'un chantier', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)

    // Cherche l'onglet Chat ou Messages
    const chatTab = page.getByRole('button', { name: /chat|message/i }).first()
    await expect(chatTab).toBeVisible({ timeout: 10000 })
    await chatTab.click()

    // Le champ de message doit apparaître
    await expect(
      page.getByPlaceholder(/message/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('Peut envoyer un message dans le chat', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)

    // Navigue vers le chat
    const chatTab = page.getByRole('button', { name: /chat|message/i }).first()
    await chatTab.click()

    // Tape le message
    const input = page.getByPlaceholder(/message/i).first()
    await expect(input).toBeVisible({ timeout: 5000 })
    await input.fill('Message test Playwright 🔧')

    // Envoie
    await page.getByRole('button', { name: /envoyer/i }).click()

    // Vérifie que le message apparaît dans la liste
    await expect(page.getByText('Message test Playwright 🔧')).toBeVisible({ timeout: 10000 })
  })

})
