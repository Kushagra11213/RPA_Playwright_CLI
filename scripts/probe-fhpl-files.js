async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const files = await frame().locator("input[type='file']").evaluateAll((els) =>
    els.map((el) => ({
      id: el.id,
      name: el.name,
      accept: el.accept,
      visible: el.offsetParent !== null,
    })),
  );
  const uploads = await frame().locator("input[type='submit'], button").evaluateAll((els) =>
    els
      .filter((el) => /upload|submit|close/i.test(`${el.value} ${el.innerText} ${el.id}`))
      .map((el) => ({ id: el.id, value: el.value || el.innerText, visible: el.offsetParent !== null })),
  );
  const heading = await frame().locator("body").innerText();
  return {
    url: page.url(),
    hasAdd: /ADD DOCUMENTS/.test(heading),
    hasPopup: /Download preauthForm/i.test(heading),
    files,
    uploads,
  };
}
