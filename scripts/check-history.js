async page => {
  const report = { checkboxes: 0, clicked: 0, errors: [] };
  const boxes = page.locator("mat-checkbox");
  report.checkboxes = await boxes.count();
  for (let index = 0; index < report.checkboxes; index += 1) {
    const box = boxes.nth(index);
    try {
      const input = box.locator("input");
      if (!(await input.isChecked())) {
        await box.click({ timeout: 4000 });
      }
      report.clicked += 1;
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message.split("\n")[0] : String(error));
    }
  }

  const answerNo = async (question) => {
    const label = page.getByText(question).first();
    await label.scrollIntoViewIfNeeded();
    const no = label.locator("xpath=following::*[@role='radio' and @aria-label='No'][1]");
    await no.click({ timeout: 4000 });
  };

  try {
    await answerNo("Do you have more than one medicial");
    report.multipleInsurance = "No";
  } catch (error) {
    report.errors.push(`multiple insurance: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
  try {
    await answerNo("family physician");
    report.familyPhysician = "No";
  } catch (error) {
    report.errors.push(`family physician: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }

  const checked = await page.locator("input.mat-checkbox-input").evaluateAll((els) => els.filter((el) => el.checked).length);
  return { report, checked };
}
