async page => {
  const popup = page.locator(".swal2-popup").first();
  if (await popup.isVisible().catch(() => false)) {
    await popup.getByRole("button", { name: "OK" }).click();
  }
  const close = page.locator("mat-dialog-container").getByRole("button", { name: "close" });
  if (await close.count()) {
    await close.first().click();
  }
  await page.locator("h5, h6").filter({ hasText: "New claim" }).first().scrollIntoViewIfNeeded();
  const summary = await page.evaluate(() => {
    const valueOf = (placeholder) => {
      const el = document.querySelector(`[data-placeholder="${placeholder}"]`);
      return el ? el.value : "";
    };
    const docs = [...document.querySelectorAll("button")].map((button) => button.innerText.replace(/\s+/g, " ").trim()).find((text) => /Documents/.test(text)) || "";
    const save = [...document.querySelectorAll("button")].some((button) => /Save Claim/i.test(button.innerText));
    return {
      url: location.href,
      member: valueOf("Enter Member Id"),
      name: valueOf("Name"),
      policy: valueOf("Policy Number"),
      dob: valueOf("Date Of Birth"),
      admission: valueOf("Date of Admission"),
      discharge: valueOf("Expected Date Of Discharge"),
      doctor: valueOf("Doctor Name"),
      docs,
      saveClaimStillVisible: save,
    };
  });
  return summary;
}
