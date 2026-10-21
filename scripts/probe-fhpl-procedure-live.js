async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const diagnosis = frame.locator(`${hospital}txtPrimaryDiagnosis`);
  await diagnosis.click();
  await diagnosis.fill("");
  await diagnosis.pressSequentially("E11.65", { delay: 30 });
  const suggestion = frame.locator(".ui-menu-item, .ui-autocomplete li").filter({ hasText: "E11.65" }).first();
  await suggestion.waitFor({ state: "visible", timeout: 8000 });
  await suggestion.click();
  await frame.locator(`${hospital}hdnPrimaryDiagnosisId`).evaluate((el) => {
    el.value = el.value.trim();
  });
  const before = {
    diagnosis: await diagnosis.inputValue(),
    icd: await frame.locator(`${hospital}txtICD10Code`).inputValue(),
    id: await frame.locator(`${hospital}hdnPrimaryDiagnosisId`).inputValue(),
    doctor: await frame.locator(`${hospital}txtHospitalDoctorName`).inputValue(),
  };
  await frame.locator(`${hospital}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
  const afterTreatment = await frame.locator(`${hospital}txtHospitalDoctorName`).inputValue();
  await frame.locator(`${hospital}ddlProcedure`).selectOption({ value: "771" });
  await page.waitForTimeout(1000);
  return {
    url: page.url(),
    before,
    afterTreatment,
    procedure: await frame.locator(`${hospital}ddlProcedure`).evaluate((el) => el.options[el.selectedIndex]?.text ?? "").catch(() => "missing"),
  };
}
