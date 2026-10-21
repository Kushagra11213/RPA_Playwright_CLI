async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const notes = [];
  page.on("response", async (response) => {
    if (response.status() < 400 && !/Errorpage/i.test(response.url())) return;
    const body = await response.text().catch(() => "");
    notes.push({ status: response.status(), url: response.url().slice(0, 160), body: body.replace(/\s+/g, " ").slice(0, 500) });
  });
  const ensure = async (suffix, value) => {
    const locator = frame.locator(`${hospital}${suffix}`);
    if (!(await locator.inputValue())) await locator.fill(value);
  };
  await ensure("txtHospitalDoctorName", "Dr Dummy Physician");
  await ensure("txtDoctorMobile", "9811111111");
  await ensure("txtEstimatedDays", "3");
  await ensure("txtPresentComplaint", "Increased thirst and frequent urination for two days.");
  await ensure("txtPasthistoryofpresentAliment", "Known type 2 diabetes. Dummy history for this request.");
  const admission = frame.locator(`${hospital}txtDateOfAdmission`);
  if (!(await admission.inputValue())) {
    await admission.evaluate((el) => {
      const jq = window.jQuery?.(el);
      if (jq?.datepicker) jq.datepicker("setDate", "22/10/2026");
      else el.value = "22/10/2026";
    });
  }
  const room = frame.locator(`${hospital}ddlClassOfAccomodation`);
  if ((await room.inputValue()) === "0") await room.selectOption({ label: "General" });
  const route = frame.locator(`${hospital}ddlRouteOfDrug`);
  if ((await route.inputValue()) === "0" || (await route.inputValue()) === "") await route.selectOption({ label: "Oral" });
  const admissionType = frame.locator(`${hospital}ddlAdmissionType`);
  if (/select/i.test(await admissionType.evaluate((el) => el.options[el.selectedIndex]?.text ?? ""))) {
    await admissionType.selectOption({ label: "Planned" });
  }
  const id = await frame.locator(`${hospital}hdnPrimaryDiagnosisId`).inputValue();
  await frame.locator(`${hospital}ddlProcedure`).selectOption({ value: "771" });
  await page.waitForTimeout(1500);
  const live = page.frames().find((item) => item.url().includes("PreauthRequest"));
  return {
    url: page.url(),
    id,
    notes: notes.slice(0, 3),
    procedure: live ? await live.locator(`${hospital}ddlProcedure`).evaluate((el) => el.options[el.selectedIndex]?.text ?? "").catch(() => "missing") : "no-frame",
  };
}
