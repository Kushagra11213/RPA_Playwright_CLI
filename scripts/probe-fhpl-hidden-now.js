async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const hiddens = await frame.locator("input[type='hidden']").evaluateAll((els) =>
    els
      .filter((el) => /Hospital|Diagnos|Procedure|ICD/i.test(el.id) && el.value)
      .map((el) => ({ id: el.id.split("_").slice(-2).join("_"), value: el.value.slice(0, 100) })),
  );
  const procedure = await frame.locator(`${hospital}ddlProcedure`).evaluate((el) => ({
    disabled: el.disabled,
    selected: el.options[el.selectedIndex]?.text ?? "",
    sample: [...el.options].slice(0, 8).map((option) => ({ text: option.text, value: option.value })),
  }));
  const script = await frame.evaluate(() => {
    const text = document.documentElement.innerHTML;
    const at = text.indexOf(".autocomplete(");
    return at === -1 ? text.slice(text.indexOf("txtPrimaryDiagnosis"), text.indexOf("txtPrimaryDiagnosis") + 800) : text.slice(Math.max(0, at - 200), at + 900);
  });
  return {
    diagnosis: await frame.locator(`${hospital}txtPrimaryDiagnosis`).inputValue(),
    treatment: await frame.locator(`${hospital}ddlProposedLineOfTreatment`).inputValue(),
    hiddens,
    procedure,
    script,
  };
}
