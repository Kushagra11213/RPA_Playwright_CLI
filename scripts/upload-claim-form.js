async page => {
  const file = "C:/Users/settl/OneDrive/Desktop/playwrightCli/artifacts/dummy-claim.pdf";
  await page.locator("input[type=file]").first().setInputFiles(file);
  await page.waitForTimeout(1500);
  const dialog = page.locator("mat-dialog-container").first();
  const text = (await dialog.innerText()).replace(/\s+/g, " ");
  return text.slice(0, 700);
}
