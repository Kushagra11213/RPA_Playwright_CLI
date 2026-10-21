async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const grid = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_GridView1").innerText();
  const rows = grid.split(/\n/).map((line) => line.trim()).filter((line) => /dummy-claim/i.test(line));
  const dod = frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_txtDODDate");
  const finalSelect = frame().locator("#ddlPreauthCumFinal");
  return {
    answer: await finalSelect.evaluate((el) => el.options[el.selectedIndex]?.text ?? ""),
    dodVisible: await dod.isVisible().catch(() => false),
    dod: await dod.inputValue().catch(() => ""),
    finalVisible: await frame().locator("#FUFinal").isVisible().catch(() => false),
    dischargeVisible: await frame().locator("#FUDischargeSummary").isVisible().catch(() => false),
    rows,
    submit: await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnSave").isVisible(),
  };
}
