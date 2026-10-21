async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  await frame.locator(`${prefix}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
  await page.waitForTimeout(1500);
  const procedure = frame.locator(`${prefix}ddlProcedure`);
  const options = await procedure.locator("option").allTextContents();
  const diabetes = options.filter((text) => /diabet/i.test(text)).slice(0, 15);
  const buttons = await frame.locator("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails input[type='submit'], #ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails button").evaluateAll((els) =>
    els.map((el) => ({ id: el.id, value: el.value, text: el.innerText })),
  );
  const department = await frame.locator(`${prefix}ddlDepartment`).evaluate((el) => {
    let node = el.parentElement;
    const bits = [];
    for (let index = 0; index < 4 && node; index += 1) {
      bits.push(node.innerText.replace(/\s+/g, " ").trim().slice(0, 180));
      node = node.parentElement;
    }
    return { value: el.value, selected: el.options[el.selectedIndex]?.text, bits };
  });
  return {
    procedureDisabled: await procedure.isDisabled(),
    diabetes,
    optionCount: options.length,
    buttons,
    department,
  };
}
