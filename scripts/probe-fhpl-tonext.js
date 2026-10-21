async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const patient = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";

  await frame.locator(`${patient}ddlInsuranceCompany`).selectOption({ label: "Oriental Insurance Co. Ltd" });
  await frame.locator(`${patient}txtCorporateName`).fill("Abbott Healthcare Pvt Ltd : Health Care Solutions");
  await frame.locator(`${patient}txtEmployeeID`).fill("732617");
  await frame.locator(`${patient}Button3`).click();
  await frame.locator(`${patient}txtPatientName`).waitFor({ state: "visible" });
  await frame.locator(`${patient}btnPatientDetailsNext`).click();
  await frame.locator(`${hospital}txtHospitalDoctorName`).waitFor({ state: "visible" });

  await frame.locator(`${hospital}txtHospitalDoctorName`).fill("Dr Dummy Physician");
  await frame.locator(`${hospital}txtDoctorMobile`).fill("9811111111");
  await frame.locator(`${hospital}txtDateOfAdmission`).evaluate((el) => {
    const jq = window.jQuery?.(el);
    if (jq?.datepicker) jq.datepicker("setDate", "22/10/2026");
    else el.value = "22/10/2026";
  });
  await frame.locator(`${hospital}ddlClassOfAccomodation`).selectOption({ label: "General" });
  await frame.locator(`${hospital}txtEstimatedDays`).fill("3");
  await frame.locator(`${hospital}txtPresentComplaint`).fill("Increased thirst and frequent urination for two days.");
  await frame.locator(`${hospital}txtPasthistoryofpresentAliment`).fill("Known type 2 diabetes. Dummy history for this request.");

  const diagnosis = frame.locator(`${hospital}txtPrimaryDiagnosis`);
  await diagnosis.click();
  await diagnosis.fill("");
  await diagnosis.pressSequentially("E11.65", { delay: 30 });
  const suggestion = frame.locator(".ui-menu-item, .ui-autocomplete li").filter({ hasText: "E11.65" }).first();
  await suggestion.waitFor({ state: "visible", timeout: 8000 });
  await suggestion.click();
  await frame.locator(`${hospital}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
  await frame.locator(`${hospital}ddlProcedure`).evaluate((el) => {
    el.value = "771";
  });
  await frame.locator(`${hospital}ddlRouteOfDrug`).selectOption({ label: "Oral" });
  await frame.locator(`${hospital}ddlAdmissionType`).selectOption({ label: "Planned" });
  await frame.locator(`${hospital}btnHospitalizationNext`).click();
  await page.waitForTimeout(1500);
  const onForm = page.url().includes("PreauthRequest.aspx");
  if (!onForm) {
    return { url: page.url(), body: await page.locator("body").innerText() };
  }
  const active = (await frame.locator(".ajax__tab_active").innerText()).replace(/\s+/g, " ").trim();
  const mandatory = await frame.locator("#ContentPlaceHolder1_TabContainer1_body").evaluate(() => {
    const activePanel = document.querySelector(".ajax__tab_panel:not([style*='display: none'])") || document.querySelector(".ajax__tab_active");
    const root = document.querySelector("[id*='tbBillingDetails']") || document.querySelector("[id*='Past']") || activePanel || document.body;
    return [...root.querySelectorAll("td")].flatMap((cell) => {
      const own = [...cell.childNodes].map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!own.includes("*") || own.length > 160) return [];
      const control = cell.nextElementSibling?.querySelector("input:not([type='hidden']), select, textarea");
      return [{ label: own, id: control?.id ?? "", tag: control?.tagName ?? "", disabled: Boolean(control?.disabled) }];
    }).slice(0, 40);
  });
  return { url: page.url(), active, mandatory };
}
