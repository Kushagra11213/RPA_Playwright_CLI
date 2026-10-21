async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  const prefix = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  const corporate = frame.locator(`${prefix}txtCorporateName`);
  await corporate.click();
  await corporate.fill("Abbott");
  await page.waitForTimeout(1500);
  const suggestions = await frame.locator(".ui-autocomplete li, .autocomplete-suggestion, [role='option']").allTextContents();
  const events = await corporate.evaluate((el) => ({
    hasAutocomplete: Boolean(el.getAttribute("aria-autocomplete") || window.jQuery?.(el).data?.("ui-autocomplete") || window.jQuery?.(el).data?.("autocomplete")),
    outer: el.outerHTML.slice(0, 500),
  }));
  return { suggestions: suggestions.slice(0, 20), events };
}
