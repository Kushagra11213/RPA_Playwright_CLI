async page => {
  await page.keyboard.press("Escape");
  const report = { fixed: [], errors: [] };

  const policy = page.locator('input[data-placeholder="Policy Number"]').first();
  const max = await policy.evaluate((el) => el.maxLength);
  const policyValue = (max > 0 ? "DUMMYPOL01" : "POL-DUMMY-1001").slice(0, max > 0 ? max : undefined);
  await policy.fill(policyValue);
  report.fixed.push(`Policy Number=${policyValue} max=${max}`);

  await page.locator('input[data-placeholder="Helper Contact Number"]').first().fill("9876500000");
  report.fixed.push("Helper Contact Number=9876500000");
  await page.locator('input[data-placeholder="Contact Number"]').first().fill("9811111111");
  report.fixed.push("Doctor Contact Number=9811111111");

  const chargeInputs = page.locator(
    "input[type=number]:not([readonly]):not([data-placeholder=MM]):not([data-placeholder=YYYY])",
  );
  const chargeValues = ["3", "1", "5000", "1", "2000", "500", "3", "3000", "4000", "500", "1500", "8000", "2000", "1000", "1500", "800"];
  const chargeLabels = [
    "Duration",
    "Packages unit",
    "Packages amount",
    "Implants unit",
    "Implants amount",
    "Others",
    "Room unit",
    "Room amount",
    "OT",
    "Ambulance",
    "Investigation",
    "Surgeon",
    "Anesthetist",
    "Consultation",
    "Medicines",
    "Consumables",
  ];
  const chargeCount = await chargeInputs.count();
  for (let index = 0; index < Math.min(chargeCount, chargeValues.length); index += 1) {
    const input = chargeInputs.nth(index);
    try {
      await input.scrollIntoViewIfNeeded();
      await input.click();
      await input.fill("");
      await input.pressSequentially(chargeValues[index], { delay: 20 });
      await input.press("Tab");
      report.fixed.push(`${chargeLabels[index]}=${await input.inputValue()}`);
    } catch (error) {
      report.errors.push(`${chargeLabels[index]}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  }

  try {
    const insurer = page.getByRole("combobox", { name: "Insurer Insurer" }).last();
    await insurer.scrollIntoViewIfNeeded();
    await insurer.click();
    const options = page.getByRole("option");
    await options.first().waitFor({ state: "visible", timeout: 6000 });
    const names = (await options.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const match = names.find((text) => /hdfc/i.test(text)) ?? names[0];
    await page.getByRole("option", { name: match, exact: true }).first().click();
    report.fixed.push(`Insurer=${match}`);
  } catch (error) {
    await page.keyboard.press("Escape");
    report.errors.push(`Insurer: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }

  const blanks = await page.locator("input, textarea").evaluateAll((els) =>
    els
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !el.readOnly && !el.value && el.type !== "radio" && el.type !== "checkbox";
      })
      .map((el) => {
        let node = el.parentElement;
        let context = "";
        for (let i = 0; i < 5 && node; i += 1) {
          const text = (node.innerText || "").replace(/\s+/g, " ").trim();
          if (text && text.length < 120) {
            context = text;
            break;
          }
          node = node.parentElement;
        }
        return {
          placeholder: el.getAttribute("data-placeholder") || el.getAttribute("placeholder") || "",
          type: el.type,
          context,
        };
      }),
  );

  return { report, blanks };
}
