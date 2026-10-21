async page => {
  const input = page.locator('input[data-placeholder="Date Of Birth"]').first();
  await input.scrollIntoViewIfNeeded();
  const button = input.locator('xpath=following::button[@aria-label="Open calendar"][1]');
  await button.click();
  const dialog = page.locator(".mat-datepicker-content, mat-calendar, .mat-calendar").first();
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  return {
    text: (await dialog.innerText()).slice(0, 800),
    buttons: await page.locator(".mat-calendar button, mat-calendar button").evaluateAll((els) =>
      els.slice(0, 25).map((el) => ({
        label: el.getAttribute("aria-label"),
        text: el.textContent.trim(),
      })),
    ),
  };
}
