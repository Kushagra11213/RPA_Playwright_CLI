async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  page.on("dialog", async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  const closePopup = async () => {
    const close = frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_DownloadpdfBack");
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  const labels = await frame().locator("#FUFinal").evaluate((el) => {
    const row = el.closest("tr");
    const previous = row?.previousElementSibling?.innerText?.replace(/\s+/g, " ").trim() ?? "";
    const discharge = document.querySelector("#FUDischargeSummary")?.closest("tr")?.previousElementSibling?.innerText?.replace(/\s+/g, " ").trim() ?? "";
    const dod = document.querySelector("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_txtDODDate");
    return {
      finalLabel: previous,
      dischargeLabel: discharge,
      dodClass: dod?.className ?? "",
      dodReadonly: Boolean(dod?.readOnly),
    };
  });
  await closePopup();
  await frame().locator("#FUFinal").setInputFiles("artifacts/dummy-claim.pdf");
  await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnFinalbill").click();
  await page.waitForTimeout(1000);
  await closePopup();
  await frame().locator("#FUDischargeSummary").setInputFiles("artifacts/dummy-claim.pdf");
  await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_BtnDischargeSummary").click();
  await page.waitForTimeout(1000);
  await closePopup();
  const dod = frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_txtDODDate");
  await dod.evaluate((el) => {
    const jq = window.jQuery?.(el);
    if (jq?.datepicker) jq.datepicker("setDate", "25/10/2026");
    else {
      el.removeAttribute("readonly");
      el.value = "25/10/2026";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  const grid = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_GridView1").innerText();
  return {
    labels,
    dod: await dod.inputValue(),
    finalBill: (grid.match(/FinalBill/gi) || []).length,
    discharge: (grid.match(/Discharge Summary/gi) || []).length,
    dummyRows: grid.split(/\n/).map((line) => line.trim()).filter((line) => /dummy-claim/i.test(line) && /final|discharge/i.test(line)),
    submitVisible: await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnSave").isVisible(),
    url: page.url(),
  };
}
