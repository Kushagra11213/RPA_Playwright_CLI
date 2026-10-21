async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  await frame.locator(`${hospital}btnHospitalizationNext`).click();
  await page.waitForTimeout(1500);
  if (/Errorpage/i.test(page.url())) {
    return { url: page.url(), body: await page.locator("body").innerText() };
  }
  const live = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const active = await live.evaluate(() => {
    const header = document.querySelector(".ajax__tab_active, .ajax__tab_header .ajax__tab_active");
    const panels = [...document.querySelectorAll("[id*='TabContainer1_']")].filter((el) => el.id.includes("tb") && el.offsetParent !== null).map((el) => el.id);
    return { header: header?.innerText?.replace(/\s+/g, " ").trim() ?? "", panels: panels.slice(0, 12) };
  });
  const fields = await live.evaluate(() => {
    const root = [...document.querySelectorAll("div, table")].find((el) => /past history|billing/i.test(el.id) && el.offsetParent !== null)
      || document.querySelector("[id*='tbBillingDetails']")
      || document.querySelector("[id*='Past']");
    const scope = root || document.body;
    return [...scope.querySelectorAll("td")].flatMap((cell) => {
      const own = [...cell.childNodes].map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!own.includes("*") || own.length > 140) return [];
      const control = cell.nextElementSibling?.querySelector("input:not([type='hidden']), select, textarea");
      const options = control?.tagName === "SELECT" ? [...control.options].map((option) => option.text.trim()).slice(0, 12) : [];
      return [{ label: own, id: control?.id ?? "", tag: control?.tagName ?? "", disabled: Boolean(control?.disabled), options }];
    }).slice(0, 40);
  });
  return { url: page.url(), active, fields };
}
