async page => {
  await page.keyboard.press("Escape");
  const values = await page.locator("input, textarea").evaluateAll((els) =>
    els
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el) => ({
        placeholder: el.getAttribute("data-placeholder") || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "",
        value: el.value,
        readOnly: el.readOnly,
        type: el.type,
      })),
  );
  const combos = await page.getByRole("combobox").evaluateAll((els) =>
    els.map((el) => (el.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean),
  );
  return { values, combos };
}
