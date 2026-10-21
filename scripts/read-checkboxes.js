async page => {
  const boxes = await page.locator("input[type=checkbox]").evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect();
      const host = el.closest("mat-checkbox, mat-slide-toggle, label, div");
      return {
        checked: el.checked,
        visible: rect.width > 0 || rect.height > 0,
        text: (host?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        className: el.className,
      };
    }),
  );
  return boxes;
}
