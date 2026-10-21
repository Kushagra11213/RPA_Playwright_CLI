async page => {
  const frameOf = () => page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  let frame = frameOf();
  const patient = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  await frame.locator(`${patient}ddlInsuranceCompany`).selectOption({ label: "Oriental Insurance Co. Ltd" });
  frame = frameOf();
  await frame.locator(`${patient}txtCorporateName`).fill("Abbott Healthcare Pvt Ltd : Health Care Solutions");
  await frame.locator(`${patient}txtEmployeeID`).fill("732617");
  await frame.locator(`${patient}Button3`).click();
  frame = frameOf();
  await frame.locator(`${patient}txtPatientName`).waitFor({ state: "visible" });
  await frame.locator(`${patient}btnPatientDetailsNext`).click();
  frame = frameOf();
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
  await frame.locator(`${hospital}ddlRouteOfDrug`).selectOption({ label: "Oral" });
  await frame.locator(`${hospital}ddlAdmissionType`).selectOption({ label: "Planned" });
  const diagnosis = frame.locator(`${hospital}txtPrimaryDiagnosis`);
  await diagnosis.click();
  await diagnosis.fill("");
  await diagnosis.pressSequentially("E11.65", { delay: 30 });
  const suggestion = frame.locator(".ui-menu-item, .ui-autocomplete li").filter({ hasText: "E11.65" }).first();
  await suggestion.waitFor({ state: "visible", timeout: 8000 });
  await suggestion.click();
  frame = frameOf();
  await frame.locator(`${hospital}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
  frame = frameOf();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST", { timeout: 25000 });
  await frame.locator(`${hospital}ddlProcedure`).selectOption({ value: "832" });
  const response = await responsePromise.catch((error) => error);
  if (response instanceof Error) return { error: response.message.split("\n")[0], url: page.url() };
  const body = await response.text().catch(() => "");
  return {
    status: response.status(),
    responseUrl: response.url(),
    pageUrl: page.url(),
    body: body.replace(/\s+/g, " ").slice(0, 700),
  };
}
