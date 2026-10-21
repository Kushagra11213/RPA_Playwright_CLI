async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  return frame.locator("input, select, textarea").evaluateAll((els) =>
    els
      .map((el) => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        type: el.type,
        disabled: el.disabled,
        className: String(el.className || "").slice(0, 80),
      }))
      .filter((field) => /corp|emp|insur|patient|uhid|policy|gender|relat|dob|age|mobile|diagnos|icd|date|admit|disch/i.test(`${field.id} ${field.name}`)),
  );
}
