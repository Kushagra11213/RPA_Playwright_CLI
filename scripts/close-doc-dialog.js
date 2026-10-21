async page => {
  const dialog = page.locator("mat-dialog-container").first();
  const buttons = await dialog.locator("button").evaluateAll((els) =>
    els.map((el) => ({
      text: (el.innerText || "").trim(),
      label: el.getAttribute("aria-label"),
    })),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  let open = await dialog.isVisible().catch(() => false);
  if (open) {
    await dialog.locator("button").first().click({ force: true });
    await page.waitForTimeout(400);
    open = await dialog.isVisible().catch(() => false);
  }
  return { buttons, open };
}
