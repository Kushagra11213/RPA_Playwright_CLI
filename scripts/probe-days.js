async page => {
  const calendar = page.locator("mat-calendar").last();
  const open = await calendar.isVisible().catch(() => false);
  if (!open) {
    return { open: false };
  }
  const cells = await calendar.locator(".mat-calendar-body-cell").evaluateAll((els) =>
    els.map((el) => ({
      label: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim(),
      disabled: el.getAttribute("aria-disabled"),
    })),
  );
  return { open: true, text: (await calendar.innerText()).slice(0, 300), cells: cells.slice(0, 20) };
}
