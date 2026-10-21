async page => {
  const report = { filled: [], chosen: [], errors: [] };
  const note = (label, value) => report.filled.push(`${label}=${value}`);
  const fail = (label, error) => {
    report.errors.push(`${label}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  };

  page.setDefaultTimeout(20000);
  await page.locator("h5", { hasText: "New claim" }).first().waitFor({ state: "visible" });

  const choose = async (comboboxName, prefer) => {
    await page.keyboard.press("Escape");
    const combo = page.getByRole("combobox", { name: comboboxName }).first();
    await combo.scrollIntoViewIfNeeded();
    await combo.click();
    const option = page.getByRole("option");
    await option.first().waitFor({ state: "visible", timeout: 6000 });
    const names = (await option.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const match = (prefer && names.find((text) => prefer.test(text))) || names[0];
    await page.getByRole("option", { name: match, exact: true }).first().click();
    report.chosen.push({ field: comboboxName, value: match });
  };

  const setDate = async (placeholder, year, monthIndex, day) => {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    await page.keyboard.press("Escape");
    const input = page.locator(`input[data-placeholder="${placeholder}"]`).first();
    await input.scrollIntoViewIfNeeded();
    await input.locator('xpath=following::button[@aria-label="Open calendar"][1]').click();
    const calendar = page.locator("mat-calendar").last();
    await calendar.waitFor({ state: "visible", timeout: 5000 });
    await calendar.getByRole("button", { name: "Choose month and year" }).click();
    await calendar.getByText(String(year), { exact: true }).click();
    await calendar.getByText(months[monthIndex], { exact: true }).click();
    await calendar.locator(`[aria-label="${day} ${monthNames[monthIndex]} ${year}"]`).click();
    note(placeholder, await input.inputValue());
  };

  try {
    await choose(/Select Payer/, /volo health/i);
  } catch (error) {
    fail("Select Payer", error);
  }

  const textFields = [
    ["Enter Member Id", "DUMMYMEM001"],
    ["Enter Company Name", "Dummy Company"],
    ["Enter Employee Id", "EMP1001"],
    ["FIRST NAME", "DUMMY PATIENT"],
    ["Mobile Number", "9876543210"],
    ["Pin Code", "160017"],
    ["Current Address", "12 Dummy Street, Sector 17"],
    ["Current City", "Chandigarh"],
    ["Current State", "Chandigarh"],
    ["MRN/UHID", "UHID10001"],
    ["Room Number", "101"],
    ["Helper Name", "DUMMY HELPER"],
    ["Helper Contact Number", "9876500000"],
    ["Primary Insured Pan Number", "ABCDE1234F"],
    ["Primary Insured Aadhar Number", "999988887777"],
    ["Patient Pan Number", "ABCDE1234F"],
    ["Patient Aadhar Number", "999988887777"],
    ["Email Address", "dummy.patient@example.com"],
    ["Doctors Registration Number", "REG12345"],
    ["Doctor Name", "DR DUMMY KUMAR"],
    ["Contact Number", "9811111111"],
    ["Doctors Qualification", "MBBS MD"],
  ];

  for (const [name, value] of textFields) {
    try {
      const byPlaceholder = page.locator(`[data-placeholder="${name}"]`).first();
      const field = (await byPlaceholder.count()) ? byPlaceholder : page.getByRole("textbox", { name, exact: true }).first();
      await field.scrollIntoViewIfNeeded();
      await field.fill(value, { timeout: 5000 });
      note(name, value);
    } catch (error) {
      fail(name, error);
    }
  }

  try {
    const policy = page.locator('[data-placeholder="Policy Number"]').first();
    const max = await policy.evaluate((el) => el.maxLength);
    const policyValue = (max > 0 ? "DUMMYPOL01" : "POL-DUMMY-1001").slice(0, max > 0 ? max : undefined);
    await policy.fill(policyValue);
    note("Policy Number", policyValue);
  } catch (error) {
    fail("Policy Number", error);
  }

  for (const [placeholder, year, monthIndex, day] of [
    ["Date Of Birth", 2010, 5, 15],
    ["Date of First consultation", 2026, 9, 18],
    ["Date of Admission", 2026, 9, 21],
    ["Expected Date Of Discharge", 2026, 9, 24],
    ["Start Date", 2026, 9, 21],
    ["End Date", 2026, 9, 24],
  ]) {
    try {
      await setDate(placeholder, year, monthIndex, day);
    } catch (error) {
      fail(placeholder, error);
    }
  }

  for (const [name, prefer] of [
    ["Relationship (With policy holder) Relationship (With policy holder)", /self|primary/i],
    ["Gender Gender", /^male$/i],
    ["Insurer Insurer", /hdfc/i],
    ["Proposed Line of Treatment Proposed Line of Treatment", /medical|management/i],
    ["Room Type Room Type", /general|single|private|semi/i],
  ]) {
    try {
      await choose(name, prefer);
    } catch (error) {
      fail(name, error);
    }
  }

  try {
    await page.keyboard.press("Escape");
    const ailment = page.getByRole("combobox", { name: /Present Ailment Common Name/ }).first();
    await ailment.scrollIntoViewIfNeeded();
    await ailment.click();
    const ailmentOptions = page.getByRole("option");
    await ailmentOptions.first().waitFor({ state: "visible", timeout: 5000 });
    const ailmentNames = (await ailmentOptions.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const choice = ailmentNames.find((text) => /fever/i.test(text)) ?? ailmentNames[0];
    await page.getByRole("option", { name: choice, exact: true }).first().click();
    report.chosen.push({ field: "Present Ailment", value: choice });
  } catch (error) {
    await page.keyboard.press("Escape");
    fail("Present Ailment", error);
  }

  try {
    const charges = page.locator("input[type=number]:not([readonly]):not([data-placeholder=MM]):not([data-placeholder=YYYY])");
    const values = ["3", "1", "5000", "1", "2000", "500", "3", "3000", "4000", "500", "1500", "8000", "2000", "1000", "1500", "800"];
    const count = Math.min(await charges.count(), values.length);
    for (let index = 0; index < count; index += 1) {
      const input = charges.nth(index);
      await input.scrollIntoViewIfNeeded();
      await input.click();
      await input.fill("");
      await input.pressSequentially(values[index], { delay: 15 });
      await input.press("Tab");
    }
    note("charges", values.join(","));
  } catch (error) {
    fail("charges", error);
  }

  for (const panelName of ["Past History", "Others"]) {
    try {
      const panel = page.getByRole("button", { name: panelName, exact: true }).first();
      if ((await panel.getAttribute("aria-expanded")) === "false") {
        await panel.click();
      }
    } catch (error) {
      fail(panelName, error);
    }
  }

  try {
    const boxes = page.locator("mat-checkbox");
    const boxCount = await boxes.count();
    for (let index = 0; index < boxCount; index += 1) {
      const box = boxes.nth(index);
      if (!(await box.locator("input").isChecked())) {
        await box.click({ timeout: 4000 });
      }
    }
    const months = page.locator('input[data-placeholder="MM"]');
    const years = page.locator('input[data-placeholder="YYYY"]');
    const dateCount = await months.count();
    for (let index = 0; index < dateCount; index += 1) {
      await months.nth(index).fill("1");
      await years.nth(index).fill("2020");
    }
    note("past history", `${boxCount} conditions since 01/2020`);
  } catch (error) {
    fail("past history", error);
  }

  for (const [placeholder, value] of [
    ["Past history of present ailment if any", "No significant past history. Dummy record."],
    ["Occupation", "Office staff"],
    ["Medical Management provide details", "Oral paracetamol for three days. Dummy management."],
    ["ICU Management provide details", "ICU care not required. Dummy record."],
    ["Investigation Management provide details", "CBC and chest X-ray. Dummy investigation."],
  ]) {
    try {
      await page.locator(`[data-placeholder="${placeholder}"]`).first().fill(value);
      note(placeholder, value);
    } catch (error) {
      fail(placeholder, error);
    }
  }

  try {
    const routes = page.locator('[data-placeholder="Route of drug administration"]');
    const routeCount = await routes.count();
    for (let index = 0; index < routeCount; index += 1) {
      await routes.nth(index).fill(index === 0 ? "Oral" : "Not applicable");
    }
    note("routes", String(routeCount));
  } catch (error) {
    fail("routes", error);
  }

  try {
    await page.getByRole("button", { name: /Documents/ }).first().click();
    const dialog = page.locator("mat-dialog-container").first();
    await dialog.waitFor({ state: "visible", timeout: 8000 });
    await dialog.locator("input[type=file]").first().setInputFiles("artifacts/dummy-claim.pdf");
    const popup = page.locator(".swal2-popup").first();
    if (await popup.isVisible({ timeout: 8000 }).catch(() => false)) {
      await popup.getByRole("button", { name: "OK" }).click();
    }
    await dialog.locator("mat-select").click({ timeout: 5000 });
    const option = page.getByRole("option");
    await option.first().waitFor({ state: "visible", timeout: 5000 });
    const names = (await option.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const category = names.find((text) => /discharge|investigation|other|bill/i.test(text)) ?? names[0];
    await page.getByRole("option", { name: category, exact: true }).first().click();
    await dialog.locator("input[type=file]").last().setInputFiles("artifacts/dummy-claim.pdf");
    if (await popup.isVisible({ timeout: 8000 }).catch(() => false)) {
      await popup.getByRole("button", { name: "OK" }).click();
    }
    note("documents", `claim form and ${category}`);
    await page.keyboard.press("Escape");
  } catch (error) {
    await page.keyboard.press("Escape");
    fail("documents", error);
  }

  await page.locator("h5", { hasText: "New claim" }).first().scrollIntoViewIfNeeded();
  const name = await page.locator('[data-placeholder="Name"], [data-placeholder="FIRST NAME"]').first().inputValue().catch(() => "");
  report.patient = name;
  report.saved = false;
  return report;
}
