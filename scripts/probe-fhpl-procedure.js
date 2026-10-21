async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const hooks = await frame.locator(`${hospital}ddlRouteOfDrug`).evaluate((el) => el.getAttribute("onchange"));
  const admissionHook = await frame.locator(`${hospital}ddlAdmissionType`).evaluate((el) => el.getAttribute("onchange"));
  await frame.locator(`${hospital}ddlDepartment`).evaluate((el) => {
    el.value = "-- Select --";
  });
  await frame.locator(`${hospital}ddlRouteOfDrug`).selectOption({ label: "Oral" });
  await frame.locator(`${hospital}ddlAdmissionType`).selectOption({ label: "Planned" });
  await frame.locator(`${hospital}ddlProcedure`).selectOption({ value: "771" });
  await page.waitForTimeout(1000);
  return {
    url: page.url(),
    hooks: { route: hooks, admission: admissionHook },
    title: await page.title(),
    procedure: await frame.locator(`${hospital}ddlProcedure`).evaluate((el) => el.options[el.selectedIndex]?.text ?? "").catch(() => "missing"),
  };
}
