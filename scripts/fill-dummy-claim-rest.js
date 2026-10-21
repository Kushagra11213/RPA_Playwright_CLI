async page => {
  const report = { filled: [], chosen: [], errors: [] };

  const note = (label, value) => report.filled.push(`${label}=${value}`);
  const fail = (label, error) => {
    report.errors.push(`${label}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  };

  const fillText = async (name, value) => {
    const box = page.getByRole("textbox", { name }).first();
    await box.scrollIntoViewIfNeeded();
    await box.fill(String(value), { timeout: 5000 });
    note(name, value);
  };

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const setDate = async (placeholder, year, monthIndex, day) => {
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

  const textFields = [
    ["Enter Member Id", "DUMMYMEM001"],
    ["Enter Employee Id", "EMP1001"],
    ["FIRST NAME", "DUMMY PATIENT"],
    ["Policy Number", "POL-DUMMY-1001"],
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
      await fillText(name, value);
    } catch (error) {
      fail(name, error);
    }
  }

  const dates = [
    ["Date Of Birth", 2010, 5, 15],
    ["Date of First consultation", 2026, 9, 18],
    ["Date of Admission", 2026, 9, 21],
    ["Expected Date Of Discharge", 2026, 9, 24],
    ["Start Date", 2026, 9, 21],
    ["End Date", 2026, 9, 24],
  ];
  for (const [placeholder, year, monthIndex, day] of dates) {
    try {
      await setDate(placeholder, year, monthIndex, day);
    } catch (error) {
      fail(placeholder, error);
    }
  }

  try {
    const duration = page.getByRole("spinbutton", { name: "Duration of the present ailment (Days)" });
    await duration.scrollIntoViewIfNeeded();
    await duration.fill("3", { timeout: 5000 });
    note("Duration days", "3");
  } catch (error) {
    fail("Duration days", error);
  }

  try {
    const spinInfo = await page.getByRole("spinbutton").evaluateAll((els) =>
      els.map((el, index) => ({
        index,
        label: el.getAttribute("aria-label") || el.getAttribute("data-placeholder") || "",
        value: el.value,
        readOnly: el.readOnly,
        disabled: el.disabled,
      })),
    );
    report.spins = spinInfo;
    const amounts = {
      1: ["1", "Packages unit"],
      2: ["5000", "Packages amount"],
      3: ["1", "Implants unit"],
      4: ["2000", "Implants amount"],
      5: ["500", "Others amount"],
      6: ["3", "Room unit"],
      7: ["3000", "Room amount"],
      8: ["4000", "OT Charges"],
      9: ["500", "Ambulance Charges"],
      10: ["1500", "Investigation"],
      11: ["8000", "Surgeon"],
      12: ["2000", "Anesthetist"],
      13: ["1000", "Consultation"],
      14: ["1500", "Medicines"],
      15: ["800", "Consumables"],
    };
    const spins = page.getByRole("spinbutton");
    for (const [index, [value, label]] of Object.entries(amounts)) {
      const target = spinInfo[Number(index)];
      if (!target || target.readOnly || target.disabled) {
        report.errors.push(`${label}: skipped readonly or missing`);
        continue;
      }
      try {
        await spins.nth(Number(index)).fill(value, { timeout: 4000 });
        note(label, value);
      } catch (error) {
        fail(label, error);
      }
    }
  } catch (error) {
    fail("amounts", error);
  }

  const dropdowns = [
    ["Relationship (With policy holder) Relationship (With policy holder)", /self/i],
    ["Gender Gender", /^male$/i],
    ["Insurer Insurer", null],
    ["Proposed Line of Treatment Proposed Line of Treatment", /medical|management/i],
    ["Room Type Room Type", /general|single|private|semi/i],
  ];
  for (const [name, prefer] of dropdowns) {
    try {
      await choose(name, prefer);
    } catch (error) {
      fail(name, error);
    }
  }

  try {
    await page.keyboard.press("Escape");
    const company = page.getByRole("combobox", { name: "Company Name Description" }).first();
    await company.scrollIntoViewIfNeeded();
    await company.click();
    await company.fill("Dummy Company");
    const companyOptions = page.getByRole("option");
    await companyOptions.first().waitFor({ state: "visible", timeout: 4000 });
    const companyNames = (await companyOptions.allTextContents()).map((text) => text.trim()).filter(Boolean);
    await companyOptions.first().click();
    report.chosen.push({ field: "Company Name", value: companyNames[0] });
  } catch (error) {
    await page.keyboard.press("Escape");
    fail("Company Name", error);
  }

  try {
    await page.keyboard.press("Escape");
    const ailment = page.getByRole("combobox", { name: /Present Ailment Common Name/ }).first();
    await ailment.scrollIntoViewIfNeeded();
    await ailment.click();
    try {
      await ailment.fill("Fever");
    } catch {
      // mat-select opens on click and does not accept typing
    }
    const ailmentOptions = page.getByRole("option");
    await ailmentOptions.first().waitFor({ state: "visible", timeout: 5000 });
    const ailmentNames = (await ailmentOptions.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const fever = ailmentNames.find((text) => /fever/i.test(text)) ?? ailmentNames[0];
    await page.getByRole("option", { name: fever, exact: true }).first().click();
    report.chosen.push({ field: "Present Ailment", value: fever, sample: ailmentNames.slice(0, 6) });
  } catch (error) {
    await page.keyboard.press("Escape");
    fail("Present Ailment", error);
  }

  await page.keyboard.press("Escape");
  return report;
}
