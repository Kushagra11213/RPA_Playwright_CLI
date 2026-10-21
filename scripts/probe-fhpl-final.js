async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const select = frame().locator("select").filter({ has: frame().locator("option", { hasText: "Select IsFinal" }) }).first();
  const before = await select.evaluate((el) => ({
    id: el.id,
    onchange: el.getAttribute("onchange"),
    value: el.value,
    options: [...el.options].map((option) => ({ text: option.text.trim(), value: option.value })),
  }));
  await select.selectOption({ label: "Yes" });
  await page.waitForTimeout(1500);
  const live = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const revealed = await live().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments").evaluate((root) => {
    return [...root.querySelectorAll("input, select, textarea")].filter((el) => el.offsetParent !== null && el.type !== "hidden").map((el) => {
      const row = el.closest("tr");
      return {
        id: el.id,
        type: el.type || el.tagName,
        value: el.value || "",
        label: (row?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160),
      };
    });
  });
  return { url: page.url(), before, revealed };
}
