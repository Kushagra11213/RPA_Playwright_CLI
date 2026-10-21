async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  return frame.locator("#ContentPlaceHolder1_TabContainer1_tbBillingDetails").evaluate((root) => {
    const rows = [...root.querySelectorAll("tr")].map((row) => {
      const cells = [...row.children].map((cell) => cell.innerText.replace(/\s+/g, " ").trim().slice(0, 80));
      const controls = [...row.querySelectorAll("input:not([type='hidden']), select, textarea")].map((el) => ({
        id: el.id.split("_").slice(-1)[0],
        type: el.type || el.tagName,
        maxLength: el.maxLength > 0 ? el.maxLength : undefined,
        placeholder: el.placeholder || "",
        disabled: el.disabled,
        className: String(el.className || "").includes("Mandatory") ? "mandatory" : "",
      }));
      return { cells, controls };
    }).filter((row) => row.controls.length || row.cells.some((cell) => cell.includes("*")));
    return rows;
  });
}
