async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const billing = "#ContentPlaceHolder1_TabContainer1_tbBillingDetails_";
  return frame.locator(`${billing}txtRoomNursingDiat`).evaluate((el) => ({
    blur: el.getAttribute("onblur"),
    keyup: el.getAttribute("onkeyup"),
    change: el.getAttribute("onchange"),
  }));
}
