async page => {
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();
  const grid = await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_GridView1").innerText().catch(() => "");
  const lines = grid.split(/\n/).map((line) => line.trim()).filter((line) => /dummy-claim/i.test(line));
  return {
    addVisible: await frame().locator("#fupreauthForm").isVisible().catch(() => false),
    dummyLines: lines.slice(0, 10),
    dummyCount: lines.length,
  };
}
