async page => {
  const frame = page.frames().find((item) => item.url().includes("PreauthRequest")) ?? page.mainFrame();
  return frame.evaluate(() => {
    const text = document.documentElement.innerHTML;
    const at = text.indexOf("select: function");
    return text.slice(at, at + 1800);
  });
}
