async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const value = async (suffix) => {
    const locator = frame.locator(`${prefix}${suffix}`);
    if ((await locator.count()) === 0) return null;
    const tag = await locator.evaluate((el) => el.tagName);
    if (tag === "SELECT") {
      return locator.evaluate((el) => ({
        selected: el.options[el.selectedIndex]?.text ?? "",
        options: [...el.options].map((option) => option.text.trim()),
        disabled: el.disabled,
      }));
    }
    return locator.inputValue();
  };
  return {
    doctor: await value("txtHospitalDoctorName"),
    mobile: await value("txtDoctorMobile"),
    admission: await value("txtDateOfAdmission"),
    room: await value("ddlClassOfAccomodation"),
    days: await value("txtEstimatedDays"),
    complaints: await value("txtPresentComplaint"),
    history: await value("txtPasthistoryofpresentAliment"),
    diagnosis: await value("txtPrimaryDiagnosis"),
    treatment: await value("ddlProposedLineOfTreatment"),
    procedure: await value("ddlProcedure"),
    route: await value("ddlRouteOfDrug"),
    admissionType: await value("ddlAdmissionType"),
    active: (await frame.locator(".ajax__tab_active").innerText()).replace(/\s+/g, " ").trim(),
  };
}
