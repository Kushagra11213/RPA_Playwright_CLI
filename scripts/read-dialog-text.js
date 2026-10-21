async page => {
  return await page.evaluate(() => {
    const popup = document.querySelector(".swal2-popup");
    const dialog = document.querySelector("mat-dialog-container");
    return {
      popup: popup ? popup.innerText.replace(/\s+/g, " ").slice(0, 200) : "",
      dialog: dialog ? dialog.innerText.replace(/\s+/g, " ").slice(0, 900) : "",
    };
  });
}
