async page => {
  const popup = page.locator(".swal2-popup");
  const dialog = page.locator("mat-dialog-container");
  const popupText = (await popup.count()) && (await popup.first().isVisible())
    ? (await popup.first().innerText()).replace(/\s+/g, " ").slice(0, 180)
    : "";
  if (popupText) {
    await popup.first().getByRole("button").last().click();
  }
  const dialogOpen = (await dialog.count()) > 0 && (await dialog.first().isVisible());
  if (dialogOpen) {
    const close = dialog.getByRole("button", { name: "close" });
    if (await close.count()) {
      await close.first().click({ force: true });
    }
  }
  return {
    popupText,
    dialogOpen,
    title: await page.title(),
    url: page.url(),
  };
}
