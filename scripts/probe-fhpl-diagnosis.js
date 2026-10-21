async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const root = frame.locator("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails");
  const mandatory = await root.locator(".cssTextBoxMandatory").evaluateAll((els) =>
    els.map((el) => ({
      id: el.id,
      tag: el.tagName,
      disabled: el.disabled,
      options: el.tagName === "SELECT" ? [...el.options].map((option) => option.text.trim()).slice(0, 30) : [],
    })),
  );
  const diagnosis = frame.locator("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_txtPrimaryDiagnosis");
  await diagnosis.click();
  await diagnosis.fill("");
  await diagnosis.pressSequentially("E11.65", { delay: 40 });
  await page.waitForTimeout(2000);
  const suggestions = await frame.locator(".ui-autocomplete:visible li, ul.ui-menu:visible li").allTextContents();
  return { mandatory, suggestions: suggestions.slice(0, 20) };
}
