async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  await frame.locator(`${prefix}txtCorporateName`).fill("Abbott Healthcare Pvt Ltd : Health Care Solutions");
  await frame.locator(`${prefix}txtEmployeeID`).fill("732617");
  await frame.locator(`${prefix}Button3`).click();
  await frame.locator(`${prefix}txtPatientName`).waitFor({ state: "visible" });
  await page.waitForTimeout(1500);
  const read = async (id) => frame.locator(id).inputValue().catch(() => "");
  return {
    patient: await read(`${prefix}txtPatientName`),
    gender: await frame.locator(`${prefix}ddlGender`).inputValue().catch(() => ""),
    relationship: await frame.locator(`${prefix}ddlRelationship`).inputValue().catch(() => ""),
    dob: await read(`${prefix}txtPatientDateOfBirth`),
    age: await read(`${prefix}txtPatientAge`),
    mobile: await read(`${prefix}txtPatientMobile`),
    policy: await read(`${prefix}txtPolicyNo`),
    alerts: await frame.locator(".alert, .validator, [id*='lbl'], .error").allTextContents().then((items) => items.map((item) => item.trim()).filter(Boolean).slice(0, 15)),
  };
}
