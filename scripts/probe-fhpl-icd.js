async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const item = frame.locator(".ui-autocomplete li, ul.ui-menu li").filter({ hasText: "E11.65" }).first();
  await item.click();
  await page.waitForTimeout(2000);
  const read = async (selector) => frame.locator(selector).inputValue();
  const options = async (selector) => frame.locator(selector).locator("option").allTextContents();
  const labeled = await frame.locator("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails").evaluate((root) => {
    const ids = [
      "ddlDepartment",
      "txtProbableDiagnostics",
      "ddlTypeofDiagnosis",
      "txtPlainOfTreatment",
      "txtICD10Code",
      "ddlProposedLineOfTreatment",
      "ddlProcedure",
    ];
    return ids.map((suffix) => {
      const el = root.querySelector(`[id$='${suffix}']`);
      const cell = el?.closest("td");
      const label = cell?.previousElementSibling?.innerText?.replace(/\s+/g, " ").trim() ?? "";
      return { suffix, label, disabled: Boolean(el?.disabled), value: String(el?.value ?? "").slice(0, 120) };
    });
  });
  return {
    diagnosis: await read(`${prefix}txtPrimaryDiagnosis`),
    diagnosisId: await read(`${prefix}hdnPrimaryDiagnosisId`),
    icd: await read(`${prefix}txtICD10Code`),
    treatment: await options(`${prefix}ddlProposedLineOfTreatment`),
    procedureDisabled: await frame.locator(`${prefix}ddlProcedure`).isDisabled(),
    procedure: (await options(`${prefix}ddlProcedure`)).slice(0, 12),
    labeled,
  };
}
