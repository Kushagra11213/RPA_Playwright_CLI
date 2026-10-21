async page => {
  const setNo = async (snippet) => {
    const groups = page.locator("[role=radiogroup]");
    const count = await groups.count();
    for (let index = 0; index < count; index += 1) {
      const group = groups.nth(index);
      const label = await group.evaluate((el) => (el.parentElement?.innerText || "").replace(/\s+/g, " "));
      if (!label.toLowerCase().includes(snippet) || label.length > 180) {
        continue;
      }
      try {
        await group.getByRole("radio", { name: "No" }).click({ timeout: 4000 });
        return label.slice(0, 90);
      } catch (error) {
        return `click failed: ${error instanceof Error ? error.message.split("\n")[0] : error}`;
      }
    }
    return `not found: ${snippet}`;
  };

  const multiple = await setNo("more than one");
  const physician = await setNo("family physician");

  await page.getByRole("button", { name: /Documents/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  const dialogText = await page.locator("body").evaluate((body) => {
    const dialog = document.querySelector("mat-dialog-container, .modal, [role=dialog]");
    return dialog ? dialog.innerText.replace(/\s+/g, " ").slice(0, 800) : "";
  });
  const fileInputs = await page.locator("input[type=file]").count();
  return { multiple, physician, dialogText, fileInputs };
}
