async page => {
  const popup = page.locator(".swal2-popup").first();
  const visible = await popup.isVisible().catch(() => false);
  const text = visible ? (await popup.innerText()).replace(/\s+/g, " ").slice(0, 400) : "";
  if (visible) {
    const confirm = popup.getByRole("button").last();
    await confirm.click();
  }
  return { visible, text };
}
