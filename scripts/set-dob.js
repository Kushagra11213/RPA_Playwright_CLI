async page => {
  const calendar = page.locator("mat-calendar").last();
  await calendar.getByText("JUN", { exact: true }).click();
  await calendar.locator('[aria-label="June 15, 2010"]').click();
  const input = page.locator('input[data-placeholder="Date Of Birth"]').first();
  return { value: await input.inputValue() };
}
