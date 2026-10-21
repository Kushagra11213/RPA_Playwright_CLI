async page => {
  return await page.evaluate(() => {
    const dialog = document.querySelector("mat-dialog-container");
    if (!dialog) {
      return { open: false, url: location.href };
    }
    const controls = [...dialog.querySelectorAll("mat-select, select, input, button")].map((el) => ({
      tag: el.tagName,
      text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 80),
      type: el.getAttribute("type"),
    }));
    return { open: true, controls };
  });
}
