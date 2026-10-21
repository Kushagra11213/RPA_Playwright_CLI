async page => {
  const dialog = page.locator("mat-dialog-container");
  const open = (await dialog.count()) > 0 && (await dialog.first().isVisible().catch(() => false));
  const docs = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => /Documents/i.test(button.innerText))
      .map((button) => button.innerText.replace(/\s+/g, " ").trim()),
  );
  return { open, docs };
}
