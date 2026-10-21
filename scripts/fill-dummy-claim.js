async page => {
  const report = { filled: [], chosen: [], errors: [] };

  const fillText = async (name, value) => {
    const box = page.getByRole("textbox", { name }).first();
    await box.scrollIntoViewIfNeeded();
    await box.fill(String(value));
    report.filled.push(`${name}=${value}`);
  };

  const fillSpin = async (locator, label, value) => {
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(String(value));
    report.filled.push(`${label}=${value}`);
  };

  const choose = async (comboboxName, prefer) => {
    const combo = page.getByRole("combobox", { name: comboboxName }).first();
    await combo.scrollIntoViewIfNeeded();
    await combo.click();
    const option = page.getByRole("option");
    await option.first().waitFor({ state: "visible", timeout: 8000 });
    const names = (await option.allTextContents()).map((text) => text.trim()).filter(Boolean);
    const wanted = prefer ? names.find((text) => prefer.test(text)) : names[0];
    const match = wanted ?? names[0];
    if (!match) {
      throw new Error(`No options for ${comboboxName}`);
    }
    await page.getByRole("option", { name: match, exact: true }).first().click();
    report.chosen.push({ field: comboboxName, value: match, sample: names.slice(0, 8) });
  };

  try {
    await fillText("Enter Member Id", "DUMMYMEM001");
    await fillText("Enter Employee Id", "EMP1001");
    await fillText("FIRST NAME", "DUMMY PATIENT");
    await fillText("Policy Number", "POL-DUMMY-1001");
    await fillText("Mobile Number", "9876543210");
    await fillText("Date Of Birth", "15/01/1990");
    await fillText("Pin Code", "160017");
    await fillText("Current Address", "12 Dummy Street, Sector 17");
    await fillText("Current City", "Chandigarh");
    await fillText("Current State", "Chandigarh");
    await fillText("MRN/UHID", "UHID10001");
    await fillText("Room Number", "101");
    await fillText("Helper Name", "DUMMY HELPER");
    await fillText("Helper Contact Number", "9876500000");
    await fillText("Primary Insured Pan Number", "ABCDE1234F");
    await fillText("Primary Insured Aadhar Number", "999988887777");
    await fillText("Patient Pan Number", "ABCDE1234F");
    await fillText("Patient Aadhar Number", "999988887777");
    await fillText("Email Address", "dummy.patient@example.com");
    await fillText("Doctors Registration Number", "REG12345");
    await fillText("Doctor Name", "DR DUMMY KUMAR");
    await fillText("Contact Number", "9811111111");
    await fillText("Doctors Qualification", "MBBS MD");
    await fillText("Date of First consultation", "18/10/2026");
    await fillText("Date of Admission", "21/10/2026");
    await fillText("Expected Date Of Discharge", "24/10/2026");
    await fillText("Start Date", "21/10/2026");
    await fillText("End Date", "24/10/2026");
    await page.keyboard.press("Escape");

    await fillSpin(page.getByRole("spinbutton", { name: "Duration of the present ailment (Days)" }), "Duration days", 3);

    const spins = page.getByRole("spinbutton");
    const amounts = [
      [1, "Packages unit", "1"],
      [2, "Packages amount", "5000"],
      [3, "Implants unit", "1"],
      [4, "Implants amount", "2000"],
      [5, "Others amount", "500"],
      [6, "Room unit", "3"],
      [7, "Room amount", "3000"],
      [8, "OT Charges", "4000"],
      [9, "Ambulance Charges", "500"],
      [10, "Investigation + Diagnostics", "1500"],
      [11, "Professional fees Surgeon", "8000"],
      [12, "Anesthetist Fees", "2000"],
      [13, "Consultation Charges", "1000"],
      [14, "Medicines", "1500"],
      [15, "Consumables", "800"],
    ];
    for (const [index, label, value] of amounts) {
      await fillSpin(spins.nth(index), label, value);
    }

    await choose("Relationship (With policy holder) Relationship (With policy holder)", /self/i);
    await choose("Gender Gender", /^male$/i);
    await choose("Insurer Insurer", null);
    await choose("Proposed Line of Treatment Proposed Line of Treatment", /medical|management/i);
    await choose("Room Type Room Type", /general|single|private|semi/i);

    const company = page.getByRole("combobox", { name: "Company Name Description" }).first();
    await company.scrollIntoViewIfNeeded();
    await company.click();
    await company.fill("Dummy Company");
    const companyOptions = page.getByRole("option");
    try {
      await companyOptions.first().waitFor({ state: "visible", timeout: 3000 });
      const companyNames = (await companyOptions.allTextContents()).map((text) => text.trim()).filter(Boolean);
      await companyOptions.first().click();
      report.chosen.push({ field: "Company Name", value: companyNames[0], sample: companyNames.slice(0, 8) });
    } catch {
      await page.keyboard.press("Escape");
      report.chosen.push({ field: "Company Name", value: "Dummy Company (typed)", sample: [] });
    }

    const ailment = page.getByRole("combobox", { name: /Present Ailment Common Name/ }).first();
    await ailment.scrollIntoViewIfNeeded();
    await ailment.click();
    await ailment.fill("Fever");
    const ailmentOptions = page.getByRole("option");
    try {
      await ailmentOptions.first().waitFor({ state: "visible", timeout: 4000 });
      const ailmentNames = (await ailmentOptions.allTextContents()).map((text) => text.trim()).filter(Boolean);
      const fever = ailmentNames.find((text) => /fever/i.test(text)) ?? ailmentNames[0];
      await page.getByRole("option", { name: fever, exact: true }).first().click();
      report.chosen.push({ field: "Present Ailment", value: fever, sample: ailmentNames.slice(0, 8) });
    } catch {
      await page.keyboard.press("Escape");
      report.errors.push("Present Ailment options did not appear");
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }

  return report;
}
