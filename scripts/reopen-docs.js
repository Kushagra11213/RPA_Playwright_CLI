async page => {
  await page.getByRole("button", { name: /Documents/ }).click();
  await page.locator("mat-dialog-container").first().waitFor({ state: "visible", timeout: 5000 });
  const text = (await page.locator("mat-dialog-container").first().innerText()).replace(/\s+/g, " ");
  return text.slice(0, 700);
}
