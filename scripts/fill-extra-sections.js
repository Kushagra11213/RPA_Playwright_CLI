async page => {
  const report = { checked: [], filled: [], errors: [] };
  const illnesses = [
    "Diabetes",
    "Asthma Bronchitis",
    "Cancer",
    "Heart Condition",
    "HIV",
    "HyperTension",
    "Hyperlipidemias",
    "Osteoarthritis",
    "Alcohol Or DrugAbuse",
    "Other Ailment",
  ];

  for (const name of illnesses) {
    try {
      const box = page.locator("mat-checkbox").filter({ hasText: name }).first();
      await box.scrollIntoViewIfNeeded();
      const input = box.locator("input[type=checkbox]");
      if (!(await input.isChecked())) {
        await box.click();
      }
      report.checked.push(name);
    } catch (error) {
      report.errors.push(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  }

  const months = page.locator('input[data-placeholder="MM"]');
  const years = page.locator('input[data-placeholder="YYYY"]');
  const count = await months.count();
  for (let index = 0; index < count; index += 1) {
    await months.nth(index).fill("1");
    await years.nth(index).fill("2020");
  }
  report.filled.push(`Past history since dates=${count}`);

  const texts = [
    ["Past history of present ailment if any", "No significant past history. Dummy record."],
    ["Occupation", "Office staff"],
    ["Medical Management provide details", "Oral paracetamol for three days. Dummy management."],
    ["ICU Management provide details", "ICU care not required. Dummy record."],
    ["Investigation Management provide details", "CBC and chest X-ray. Dummy investigation."],
  ];
  for (const [placeholder, value] of texts) {
    const field = page.locator(`[data-placeholder="${placeholder}"]`).first();
    await field.scrollIntoViewIfNeeded();
    await field.fill(value);
    report.filled.push(placeholder);
  }

  const routes = page.locator('[data-placeholder="Route of drug administration"]');
  const routeCount = await routes.count();
  for (let index = 0; index < routeCount; index += 1) {
    await routes.nth(index).fill(index === 0 ? "Oral" : "Not applicable");
  }
  report.filled.push(`Routes=${routeCount}`);

  const groups = await page.locator("[role=radiogroup]").evaluateAll((els) =>
    els
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => ({
        label: (el.parentElement?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90),
        checked: [...el.querySelectorAll("input")].find((input) => input.checked)?.getAttribute("aria-label") || "",
      })),
  );

  const insurer = await page.getByRole("combobox", { name: /Insurer/ }).last().innerText();
  const total = await page.locator("input[type=number][readonly]").last().inputValue();
  return { report, groups, insurer: insurer.replace(/\s+/g, " ").trim(), total };
}
