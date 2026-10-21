async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const next = frame.locator("#ContentPlaceHolder1_TabContainer1_tbPatientDetails_btnPatientDetailsNext");
  await next.click();
  await page.waitForTimeout(1500);
  const active = await frame.locator(".ajax__tab_active, .ajax__tab_header .ajax__tab_active").allTextContents().catch(() => []);
  const hospital = frame.locator("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails");
  const fields = await hospital.locator("td, label, span, input, select, textarea").evaluateAll((els) => {
    const rows = [];
    const cells = [...document.querySelectorAll("#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails td")];
    for (let index = 0; index < cells.length; index += 1) {
      const text = cells[index].innerText.replace(/\s+/g, " ").trim();
      if (!text.includes("*")) continue;
      const control = cells[index + 1]?.querySelector("input, select, textarea");
      rows.push({
        label: text,
        id: control?.id ?? "",
        tag: control?.tagName ?? "",
        type: control?.type ?? "",
        disabled: Boolean(control?.disabled),
        className: String(control?.className ?? "").slice(0, 100),
        value: control && control.type !== "password" ? String(control.value ?? "").slice(0, 80) : "",
      });
    }
    return rows;
  });
  return { active, fields };
}
