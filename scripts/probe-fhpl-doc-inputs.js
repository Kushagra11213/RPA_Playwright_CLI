async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const close = frame().getByRole("button", { name: "Close" });
  const popup = await close.isVisible().catch(() => false);
  if (popup) await close.click();
  const files = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments input[type='file']").evaluateAll((els) =>
    els.map((el) => {
      const row = el.closest("tr");
      const label = row?.previousElementSibling?.innerText?.replace(/\s+/g, " ").trim().slice(0, 140) ?? "";
      const upload = row?.querySelector("input[type='submit'], button");
      return {
        id: el.id,
        accept: el.accept,
        label,
        uploadId: upload?.id ?? "",
        uploadValue: upload?.value || upload?.innerText || "",
      };
    }),
  );
  return { popupClosed: popup, files };
}
