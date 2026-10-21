async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const patient = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";

  await frame.locator(`${patient}ddlInsuranceCompany`).selectOption({ label: "Oriental Insurance Co. Ltd" });
  await frame.locator(`${patient}txtCorporateName`).fill("Abbott Healthcare Pvt Ltd : Health Care Solutions");
  await frame.locator(`${patient}txtEmployeeID`).fill("732617");
  await frame.locator(`${patient}Button3`).click();
  await frame.locator(`${patient}txtPatientName`).waitFor({ state: "visible" });
  const patientName = await frame.locator(`${patient}txtPatientName`).inputValue();
  await frame.locator(`${patient}btnPatientDetailsNext`).click();
  await frame.locator(`${hospital}txtHospitalDoctorName`).waitFor({ state: "visible" });

  await frame.locator(`${hospital}txtHospitalDoctorName`).fill("Dr Dummy Physician");
  await frame.locator(`${hospital}txtDoctorMobile`).fill("9811111111");
  await frame.locator(`${hospital}txtDateOfAdmission`).evaluate((el) => {
    const jq = window.jQuery?.(el);
    if (jq?.datepicker) {
      jq.datepicker("setDate", "22/10/2026");
    } else {
      el.removeAttribute("readonly");
      el.value = "22/10/2026";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
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
  await frame.locator(`${hospital}ddlProcedure`).waitFor({ state: "attached" });

  const meta = await frame.locator(`${hospital}ddlProcedure`).evaluate((el) => ({
    disabled: el.disabled,
    onchange: el.getAttribute("onchange"),
    options: [...el.options].filter((option) => /diabet/i.test(option.text)).map((option) => ({ text: option.text, value: option.value })),
  }));
  const department = await frame.locator(`${hospital}ddlDepartment`).evaluate((el) => ({
    visible: el.offsetParent !== null,
    onchange: el.getAttribute("onchange"),
    selected: el.options[el.selectedIndex]?.text ?? "",
    value: el.value,
    placeholder: [...el.options].slice(0, 3).map((option) => ({ text: option.text, value: option.value })),
  }));
  return {
    url: page.url(),
    patientName,
    admission: await frame.locator(`${hospital}txtDateOfAdmission`).inputValue(),
    diagnosis: await frame.locator(`${hospital}txtPrimaryDiagnosis`).inputValue(),
    icd: await frame.locator(`${hospital}txtICD10Code`).inputValue(),
    meta,
    department,
  };
}
