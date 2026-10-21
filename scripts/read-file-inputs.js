async page => {
  return await page.locator("input[type=file]").evaluateAll((els) =>
    els.map((el) => ({
      accept: el.getAttribute("accept"),
      id: el.id,
      name: el.name,
      text: (el.closest("div")?.parentElement?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 180),
    })),
  );
}
