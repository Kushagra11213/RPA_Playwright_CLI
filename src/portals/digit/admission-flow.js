async page => {
  const memberId = "N782950877680317";
  const report = { filled: [], errors: [], saved: false, submitted: false, stoppedAt: "" };
  page.setDefaultTimeout(20000);

  const captureAlerts = () => {
    window.__portalAlerts = window.__portalAlerts || [];
    window.alert = (message) => window.__portalAlerts.push(String(message ?? ""));
    window.confirm = () => true;
  };

  const stamp = (days, hour) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
  };

  const register = () => page.locator("form").filter({ has: page.locator("[formcontrolname='hospitalReason']") }).first();
  const control = (name) => register().locator(`[formcontrolname="${name}"]`).locator("visible=true").first();

  const setControl = async (name, value, { overwrite = false } = {}) => {
    const input = control(name);
    if (!(await input.count().catch(() => 0))) return;
    if (!(await input.isVisible().catch(() => false))) return;
    const meta = await input.evaluate((element) => ({
      tag: element.tagName,
      type: (element.type || "").toLowerCase(),
      value: element.value || "",
      disabled: element.disabled,
      readOnly: element.readOnly,
    })).catch(() => null);
    if (!meta || meta.disabled || meta.readOnly) return;
    if (!overwrite && meta.value && !["0", "0.00"].includes(meta.value)) {
      report.filled.push(`${name}=existing:${meta.value}`);
      return;
    }
    if (meta.tag === "SELECT") {
      const selected = await input.selectOption({ label: String(value) }).catch(async () => input.selectOption(String(value)).catch(() => []));
      if (selected?.length) report.filled.push(`${name}=${value}`);
      return;
    }
    if (meta.type === "radio" || meta.type === "checkbox" || meta.type === "file") return;
    await input.fill(String(value));
    report.filled.push(`${name}=${value}`);
  };

  try {
    await page.addInitScript(captureAlerts);
    await page.evaluate(captureAlerts).catch(() => {});

    const otp = page.getByRole("textbox", { name: "Enter OTP" });
    const legacyOtp = page.locator("#code");
    const otpField = (await otp.isVisible().catch(() => false)) ? otp : legacyOtp;
    if (await otpField.isVisible().catch(() => false)) {
      const readOtp = async () => {
        const visible = (await otpField.inputValue().catch(() => "")).trim();
        const hidden = (await page.locator("#otp_hidden").inputValue().catch(() => "")).trim();
        return hidden.length >= visible.length ? hidden : visible;
      };
      const started = Date.now();
      let entered = "";
      while (Date.now() - started < 20000) {
        entered = await readOtp();
        if (entered.length >= 4) break;
        await page.waitForTimeout(500).catch(() => {});
        if (page.isClosed()) break;
      }
      if (entered.length < 4) throw new Error("OTP was not entered in the Go Digit OTP box.");
      await page.getByRole("button", { name: /^login$/i }).click();
      await page.waitForURL((url) => !url.href.includes("accounts.godigit.com"), { timeout: 30000 }).catch(() => {});
      const stillThere = await otp.isVisible().catch(() => false);
      if (stillThere && page.url().includes("accounts.godigit.com")) {
        throw new Error("OTP verification did not leave the login page.");
      }
      report.filled.push("otp=verified");
    }

    const admission = page.locator("a[href*='new-admission']").first();
    await admission.waitFor({ state: "attached", timeout: 30000 });
    if (await admission.isVisible().catch(() => false)) {
      await admission.click();
    } else {
      const origin = new URL(page.url()).origin;
      await page.goto(`${origin}/#/home/new-admission`);
    }
    report.filled.push("opened=admission");

    const searchBy = page.locator("select[formcontrolname='patientSearchTxt']");
    await searchBy.waitFor({ state: "visible" });
    await searchBy.selectOption("Member ID");
    await page.waitForTimeout(400);
    const memberField = page.locator("input[formcontrolname='searchText']");
    await memberField.fill(memberId);
    report.filled.push(`memberId=${memberId}`);

    const search = page.getByRole("button", { name: /^search member$/i });
    await search.click();
    report.filled.push("search=clicked");

    const resultSelect = page.locator(".policy-card").getByRole("button", { name: /^select$/i }).first();
    await resultSelect.waitFor({ state: "visible", timeout: 25000 });
    await resultSelect.click();
    report.filled.push("member=selected");

    await page.locator("select[formcontrolname='hospitalReason']").waitFor({ state: "visible" });
    await setControl("hospitalReason", "Illness", { overwrite: true });
    await page.locator("select[formcontrolname='treatmentType']").waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await setControl("treatmentType", "Medical Management", { overwrite: true });
    await setControl("duration", "0-7 days", { overwrite: true });
    await setControl("roomType", "Semi private", { overwrite: true });
    await setControl("requestType", "Initial Authorization Request");
    await setControl("gender", "Male");

    const textValues = {
      patientName: "Dummy Patient",
      patientDob: "1990-01-01",
      patientContactNo: "9811111111",
      patientEmail: "dummy.patient@example.com",
      attendeeFullName: "Dummy Attendee",
      attendeeContactNo: "9811111112",
      attendeeEmail: "dummy.attendee@example.com",
      uhid: "UHID1001",
      abhaNumber: "12345678901234",
      departmentName: "General Medicine",
      doctorName: "Dummy Physician",
      doctorContactNo: "9811111113",
      medicalRegistrationNo: "REG1001",
      provisionalDiagnosis: "Type 2 diabetes mellitus",
      icdCode: "E119",
      icdCodeDescription: "Type 2 diabetes mellitus",
      IllnessNature: "Increased thirst and frequent urination",
      pastHistory: "Known diabetes mellitus",
      firstConsultDate: "2026-10-15",
      treatmentDesc: "Medical management",
      inpatientNumber: "IP1001",
      tentativeAdmissionDateTime: stamp(1, 10),
      tentativeDischargeDateTime: stamp(4, 10),
      lengthOfStay: "3",
      roomRent: "1000",
      nursing: "500",
      investigation_diagnostic: "1000",
      icuCharges: "0",
      otCharges: "0",
      surgeonFees: "0",
      consultationCharges: "500",
      anaesthetistFees: "0",
      Medicines: "1500",
      consumables2: "200",
      implantsCost: "0",
      otherExpense: "100",
      packagecharge: "0",
    };
    for (const [name, value] of Object.entries(textValues)) {
      const overwrite = /roomRent|nursing|investigation|icuCharges|otCharges|surgeonFees|consultation|anaesthetist|Medicines|consumables|implants|otherExpense|packagecharge|lengthOfStay|tentative|Illness|pastHistory|treatmentDesc|provisional|icd|department|doctor|inpatient|firstConsult/.test(name);
      await setControl(name, value, { overwrite });
    }

    await register().locator("input[type='radio'][value='No']").evaluateAll((nodes) => {
      for (const node of nodes) {
        if (node.disabled || node.offsetParent === null) continue;
        const group = node.form ? [...node.form.querySelectorAll(`input[type="radio"][name="${node.name}"]`)] : [node];
        if (!group.some((item) => item.checked)) node.click();
      }
    }).catch(() => {});

    const blanks = register().locator("input:visible, select:visible, textarea:visible");
    const blankCount = await blanks.count().catch(() => 0);
    for (let index = 0; index < blankCount; index += 1) {
      const input = blanks.nth(index);
      const written = await input.evaluate((element) => {
        if (element.disabled || element.readOnly) return "";
        const type = (element.type || "").toLowerCase();
        if (["hidden", "file", "radio", "checkbox", "button", "submit"].includes(type)) return "";
        if (element.value && element.value !== "0") return "";
        if (element.tagName === "SELECT") {
          const option = [...element.options].find((item) => item.value && !item.disabled);
          if (!option) return "";
          element.value = option.value;
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return `${element.getAttribute("formcontrolname") || element.name}=${option.label || option.value}`;
        }
        let next = "Dummy";
        if (type === "email") next = "dummy@example.com";
        else if (type === "number") next = "100";
        else if (type === "date") next = "2026-10-15";
        else if (type === "datetime-local") next = "2026-10-23T10:00";
        else if (type === "tel" || element.maxLength === 10) next = "9811111111";
        element.value = next;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return `${element.getAttribute("formcontrolname") || element.name}=${next}`;
      }).catch(() => "");
      if (written) report.filled.push(written);
    }

    const files = register().locator("input[type='file']");
    const fileCount = await files.count().catch(() => 0);
    for (let index = 0; index < fileCount; index += 1) {
      await files.nth(index).setInputFiles("artifacts/dummy-claim.pdf").catch(() => {});
    }
    if (fileCount) report.filled.push("file=dummy-claim.pdf");

    report.submitted = false;
    report.stoppedAt = "form";
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
  return report;
}
