import { expect, test } from "@playwright/test"

test("home loads the public shell", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /aprenda, compre e acesse tudo/i })).toBeVisible()
  await expect(page.getByRole("link", { name: /ver produtos/i })).toBeVisible()
})
