import { expect, test } from "@playwright/test"

test("home loads the public shell", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /aprende com mais clareza/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /explorar produtos/i }).first()).toBeVisible()
})

test("checkout shows a helpful empty state without product", async ({ page }) => {
  await page.goto("/checkout")
  await expect(page.getByText(/checkout sem produto/i)).toBeVisible()
})

test("login page loads the auth shell", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: /continua o teu acesso/i })).toBeVisible()
})

test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page.locator("body")).toContainText(/carregando sessao|entrar/i)
})

test("admin redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/admin")
  await expect(page.locator("body")).toContainText(/validando acesso administrativo|entrar/i)
})
