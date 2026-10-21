async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const fill = async (suffix, value) => {
    const locator = frame.locator(`${prefix}${suffix}`);
    await locator.fill(value);
  };
  await fill("txtHospitalDoctorName", "Dr Dummy Physician");
  await fill("txtDoctorMobile", "9811111111");
  const admission = frame.locator(`${prefix}txtDateOfAdmission`);
  await admission.evaluate((el) => {
    el.removeAttribute("readonly");
    el.value = "22/10/2026";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  });
  await frame.locator(`${prefix}ddlClassOfAccomodation`).selectOption({ label: "General" });
  await fill("txtEstimatedDays", "3");
  await fill("txtPresentComplaint", "Increased thirst and frequent urination for two days.");
  await fill("txtPasthistoryofpresentAliment", "Known type 2 diabetes. Dummy history for this request.");
  await frame.locator(`${prefix}ddlProcedure`).selectOption({ label: "TYPE 2 DIABETES MELLITUS " });
  await frame.locator(`${prefix}ddlRouteOfDrug`).selectOption({ label: "Oral" });
  await frame.locator(`${prefix}ddlAdmissionType`).selectOption({ label: "Planned" });
  await frame.locator(`${prefix}btnHospitalizationNext`).click();
  await page.waitForTimeout(1500);
  const active = await frame.locator(".ajax__tab_active").innerText();
  const messages = await frame.locator(".ajax__validatorcallout, [id*='Validator'], .error").allInnerTexts();
  const billing = await frame.locator("#ContentPlaceHolder1_TabContainer1_tbBillingDetails, #ContentPlaceHolder1_TabContainer1_tbPastHistory").evaluateAll(() => {
    const root = document.querySelector("[id*='tbBillingDetails'], [id*='PastHistory']");
    if (!root) return [];
    return [...root.querySelectorAll("td")].flatMap((cell) => {
      const text = cell.innerText.replace(/\s+/g, " ").trim();
      if (!text.includes("*") || text.length > 180) return [];
      const control = cell.nextElementSibling?.querySelector("input, select, textarea");
      return [{ label: text, id: control?.id ?? "", disabled: Boolean(control?.disabled), value: String(control?.value ?? "").slice(0, 40) }];
    });
  });
  return {
    active: active.replace(/\s+/g, " ").trim(),
    admission: await admission.inputValue(),
    messages: messages.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 20),
    billing,
  };
}
