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
  await frame.locator(`${hospital}ddlRouteOfDrug`).selectOption({ label: "Oral" });
  await frame.locator(`${hospital}ddlAdmissionType`).selectOption({ label: "Planned" });
  await frame.locator(`${hospital}btnHospitalizationNext`).click();
  const outcome = await Promise.race([
    page.waitForURL(/Errorpage/, { timeout: 20000 }).then(() => "error"),
    frame.getByText("Past History", { exact: false }).waitFor({ timeout: 20000 }).then(() => "billing"),
  ]).catch((error) => `timeout ${error.message.split("\n")[0]}`);
  const callouts = await frame.locator(".ajax__validatorcallout_popup_table, [id*='callout']").allInnerTexts().catch(() => []);
  return { outcome, url: page.url(), callouts: callouts.slice(0, 8) };
}
