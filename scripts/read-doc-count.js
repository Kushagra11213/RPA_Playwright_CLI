async page => {
  return await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => /Documents/i.test(button.innerText))
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.innerText.replace(/\s+/g, " ").trim(),
          visible: rect.width > 0 && rect.height > 0,
        };
      }),
  );
}
