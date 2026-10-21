async page => {
  const pdf = "C:/Users/settl/OneDrive/Desktop/playwrightCli/artifacts/dummy-claim.pdf";
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const notes = [];
  page.on("dialog", async (dialog) => {
    notes.push(dialog.message().slice(0, 180));
    await dialog.accept().catch(() => {});
  });
  const closePopup = async () => {
    const close = frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_DownloadpdfBack");
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  const slots = [
    ["fupreauthForm", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnPreauthForm"],
    ["fuPatientIDProof", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnPatienIDProof"],
    ["fuInvestigationFile", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnInvestigationFile"],
    ["fuConsultantPapers", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnClncultantPapers"],
    ["fuInvestigation", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnInvetigation"],
    ["fuAadhar", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnAadhar"],
  ];
  await closePopup();
  for (const [fileId, buttonId] of slots) {
    await frame().locator(`#${fileId}`).setInputFiles(pdf);
    await frame().locator(`#${buttonId}`).click();
    await page.waitForTimeout(1000);
    await closePopup();
    if (/Errorpage/i.test(page.url())) {
      notes.push(`error after ${fileId}`);
      break;
    }
  }
  const uploaded = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_GridView1").innerText().catch(() => "");
  const dummyCount = (uploaded.match(/dummy-claim\.pdf/gi) || []).length;
  const submitVisible = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnSave").isVisible().catch(() => false);
  return { dummyCount, submitVisible, notes, url: page.url() };
}
