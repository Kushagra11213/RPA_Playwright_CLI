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
  await frame.locator(`${hospital}txtPrimaryDiagnosis`).waitFor({ state: "visible" });
  const diagnosis = frame.locator(`${hospital}txtPrimaryDiagnosis`);
  await diagnosis.click();
  await diagnosis.fill("");
  await diagnosis.pressSequentially("E11.65", { delay: 30 });
  const suggestion = frame.locator(".ui-menu-item, .ui-autocomplete li").filter({ hasText: "E11.65" }).first();
  await suggestion.waitFor({ state: "visible", timeout: 8000 });
  await suggestion.click();
  await frame.locator(`${hospital}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
  const hiddens = await frame.locator("[id*='tbHospitalizationDetails'] input[type='hidden']").evaluateAll((els) =>
    els.map((el) => ({ id: el.id.split("_").slice(-1)[0], value: el.value.slice(0, 80) })).filter((el) => el.value),
  );
  const script = await frame.evaluate(() => {
    const text = document.documentElement.innerHTML;
    const at = text.indexOf("txtPrimaryDiagnosis");
    return text.slice(at, at + 1200);
  });
  return { hiddens, script };
}
