async page => {
  const file = "C:/Users/settl/OneDrive/Desktop/playwrightCli/artifacts/dummy-claim.pdf";
  const dialog = page.locator("mat-dialog-container").first();
  await dialog.locator("mat-select").click();
  const option = page.getByRole("option");
  await option.first().waitFor({ state: "visible", timeout: 5000 });
  const names = (await option.allTextContents()).map((text) => text.trim()).filter(Boolean);
  const choice = names.find((text) => /discharge|investigation|other|bill/i.test(text)) ?? names[0];
  await page.getByRole("option", { name: choice, exact: true }).first().click();
  await dialog.locator("input[type=file]").last().setInputFiles(file);
  await dialog.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(1500);
  return {
    category: choice,
    sample: names.slice(0, 10),
    dialog: (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 800),
  };
}
