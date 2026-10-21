async page => {
  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss().catch(async () => dialog.accept());
  });
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  await frame().locator("#ContentPlaceHolder1_TabContainer1_tbBillingDetails_btnBillingDetails").click();
  await page.waitForTimeout(1500);
  const popups = await frame().locator("[role='dialog'], .modal, .swal2-popup, .ajax__validatorcallout, .popup, #popupdiv").allInnerTexts().catch(() => []);
  return { url: page.url(), title: await page.title(), dialogs, popups: popups.slice(0, 6) };
}
