async page => {
  const panel = async (name) => {
    const button = page.getByRole("button", { name, exact: true }).first();
    const expanded = await button.getAttribute("aria-expanded");
    if (expanded === "false") {
      await button.click();
    }
    return expanded;
  };

  const pastExpanded = await panel("Past History");
  const othersExpanded = await panel("Others");

  const history = await page.locator('input[data-placeholder="MM"]').evaluateAll((els) =>
    els.map((el) => {
      const row = el.closest("div");
      let node = el.parentElement;
      let text = "";
      for (let i = 0; i < 8 && node; i += 1) {
        const candidate = (node.innerText || "").replace(/\s+/g, " ").trim();
        if (candidate && candidate.length < 180 && !/^MM/.test(candidate)) {
          text = candidate;
          break;
        }
        node = node.parentElement;
      }
      const checkbox = row?.parentElement?.querySelector('input[type="checkbox"]');
      return { text, checked: checkbox ? checkbox.checked : null };
    }),
  );

  const radios = await page.getByRole("radio").evaluateAll((els) =>
    els.map((el) => ({
      name: el.getAttribute("aria-label") || el.labels?.[0]?.innerText || "",
      value: el.value,
      checked: el.checked,
      group: (el.closest("[role=radiogroup]")?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
    })),
  );

  return { pastExpanded, othersExpanded, history, radios };
}
