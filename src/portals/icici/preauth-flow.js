async page => {
  const uhid = "100000998810";
  const report = { filled: [], errors: [], saved: false, submitted: false, stoppedAt: "", fields: [] };
  page.setDefaultTimeout(20000);

  const frames = () => page.frames();

  const captureAlerts = () => {
    window.__iciciAlerts = window.__iciciAlerts || [];
    const push = (message) => window.__iciciAlerts.push(String(message ?? ""));
    window.alert = push;
    window.confirm = () => true;
  };

  const readAlerts = async () => {
    const messages = [];
    for (const frame of frames()) {
      const found = await frame
        .evaluate(() => {
          const list = window.__iciciAlerts || [];
          window.__iciciAlerts = [];
          return list;
        })
        .catch(() => []);
      messages.push(...found);
    }
    const problem = messages.find((message) => /invalid|incorrect|fail|error|expired|not found|no record/i.test(message));
    if (problem) throw new Error(problem);
    return messages;
  };

  const firstVisible = async (builders) => {
    for (const frame of frames()) {
      for (const build of builders) {
        const locator = build(frame);
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const candidate = locator.nth(index);
          if (await candidate.isVisible().catch(() => false)) return candidate;
        }
      }
    }
    return null;
  };

  try {
    await page.addInitScript(captureAlerts);
    for (const frame of frames()) {
      await frame.evaluate(captureAlerts).catch(() => {});
    }

    const otp = page.locator("#txtOTP");
    if (await otp.isVisible().catch(() => false)) {
      const started = Date.now();
      let entered = "";
      while (Date.now() - started < 180000) {
        entered = (await otp.inputValue().catch(() => "")).trim();
        if (entered.length >= 4) break;
        await page.waitForTimeout(1000);
      }
      if (entered.length < 4) throw new Error("OTP was not available.");
      await page.locator("#btnVerify").click();
      await page.waitForTimeout(2500);
      await readAlerts();
      const stillThere = await otp.isVisible().catch(() => false);
      if (stillThere && page.url().includes("/Home/Login")) {
        throw new Error("OTP verification did not leave the login page.");
      }
      report.filled.push("otp=verified");
    }

    const onForm = await page.locator("#txtTreatingDrName").isVisible().catch(() => false);
    if (!onForm) {
      if (!/SearchPreAuthCashlessRequest/i.test(page.url())) {
        const preauth = await firstVisible([
          (frame) => frame.getByRole("link", { name: /Add\s*\/\s*View IPD PreAuth/i }),
          (frame) => frame.getByRole("button", { name: /Add\s*\/\s*View IPD PreAuth/i }),
          (frame) => frame.locator("a[href*='SearchPreAuthCashlessRequest']"),
        ]);
        if (preauth) {
          await preauth.click();
          await page.waitForTimeout(1500);
          report.filled.push("opened=ipd-preauth");
        }
      }

      const uhidField = await firstVisible([
        (frame) => frame.getByLabel(/Health Card Number\s*\/\s*UHID/i),
        (frame) => frame.getByPlaceholder(/Health Card Number|UHID/i),
        (frame) => frame.getByText(/Health Card Number\s*\/\s*UHID/i).locator("xpath=following::input[not(@type='hidden')][1]"),
      ]);
      if (!uhidField) throw new Error("Could not find Health Card Number / UHID.");
      await uhidField.fill(uhid);
      report.filled.push(`uhid=${uhid}`);

      const search = await firstVisible([
        (frame) => frame.getByRole("button", { name: /^search$/i }),
        (frame) => frame.locator("input[type='button'][value='Search' i], input[type='submit'][value='Search' i]"),
      ]);
      if (!search) throw new Error("Could not find the Search button.");
      await search.click();
      await readAlerts();
      report.filled.push("search=clicked");

      const started = Date.now();
      let patient = null;
      while (Date.now() - started < 15000) {
        patient = await firstVisible([
          (frame) => frame.locator("tr[onclick*='Redirect']", { hasText: uhid }).locator("td").first(),
        ]);
        if (patient) break;
        await page.waitForTimeout(500);
      }
      if (!patient) throw new Error(`Search did not show a selectable patient for ${uhid}.`);
      await patient.click();
      const opened = await page
        .locator("#txtTreatingDrName")
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) {
        await patient.evaluate((cell) => {
          const row = cell.closest("tr");
          if (row && typeof Redirect === "function") Redirect(row);
          else row?.click();
        }).catch(() => {});
        await page.locator("#txtTreatingDrName").waitFor({ state: "visible" });
      }
      report.filled.push("patient=selected");
    } else {
      report.filled.push("patient=already-open");
    }

    const field = (id) => page.locator(`#${id}`);
    const mark = async (id) => {
      const box = field(id);
      if (!(await box.count().catch(() => 0))) return;
      await box.evaluate((element) => {
        element.disabled = false;
        element.removeAttribute("disabled");
        if (!element.checked) element.click();
        else element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      report.filled.push(`${id}=checked`);
    };
    for (const id of [
      "Radio_Treatment_Medical",
      "Radio_Procedure_Single",
      "rbtnMedical",
      "Radio_PED_YES",
      "Radio_AlPED_NO",
      "chkFinalBill_NO",
      "Radio_PREAUTH_YES",
      "Radio_IDPROOF_YES",
      "Radio_REPORTS_YES",
    ]) {
      await mark(id);
    }
    for (const id of [
      "phHypertension",
      "phDiabetes",
      "phArthritis",
      "phCancer",
      "phCOPD",
      "phMaternity",
      "phHeart",
      "phAsthma",
      "phSTD",
      "phAccident",
      "firmlc",
    ]) {
      await mark(id);
    }

    const selects = {
      ddlDisease_Type: "99",
      ddlDocumentType2: "Pre-Auth Form",
      ddlSearchCriteria: "N",
    };
    for (const [id, value] of Object.entries(selects)) {
      const input = field(id);
      if (!(await input.count().catch(() => 0))) continue;
      const chosen = await input.evaluate((element, preferred) => {
        const option = [...element.options].find((item) => item.value === preferred)
          || [...element.options].find((item) => item.value && !/select|----/i.test(item.text));
        if (!option) return "";
        element.value = option.value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return `${option.value}|${option.text.trim()}`;
      }, value).catch(() => "");
      if (chosen) report.filled.push(`${id}=${chosen}`);
    }
    await mark("rbtnPhotocopy2");

    const values = {
      txtInsuredMobileNo: "9811111111",
      txtagepatient: "45",
      txtAbha_ID: "12345678901234",
      landlineno: "01722654321",
      txtPatient_IP_no: "IP1001",
      txtTreatingDrName: "Dr Dummy Physician",
      txtMobileNo: "9811111111",
      txtQualifications: "MBBS",
      ddlother_procedure_Type: "Type 2 diabetes mellitus",
      presentComplaints: "Increased thirst and frequent urination for two days.",
      releventClinical: "Known diabetes mellitus. Dummy clinical findings.",
      lombardDiag: "Type 2 diabetes mellitus",
      provisionalDeff: "Type 2 diabetes mellitus",
      condition: "Stable",
      treatment: "Medical management",
      procedureDone: "Medical management",
      hypertension: "01/01/2024",
      diabetes: "01/01/2024",
      osteologyArth: "01/01/2024",
      cancers: "01/01/2024",
      COPD: "01/01/2024",
      coronaryDisease: "01/01/2024",
      asthma: "01/01/2024",
      stdhiv: "01/01/2024",
      matLMP: "01/09/2026",
      matEDD: "08/06/2027",
      matLSCS: "Dummy indication",
      "oh-g": "2",
      "oh-p": "1",
      "oh-a": "0",
      "oh-l": "1",
      menhistory: "Regular",
      accident: "01/10/2026",
      locationFir: "Chandigarh",
      firmlcNumber: "FIR1001",
      txtDOA: "22/10/2026",
      bill_Room_rent_perday: "1000",
      los: "3",
      Total_Room_Rent: "300",
      txtTotal_consultation: "500",
      txt_consumables: "1500",
      txt_Pharmacy: "1500",
      txt_Investigations: "1000",
      txt_Dialysis_Rate_per_Sitting: "500",
      txtnoofsession: "1",
      requestedAmount: "5800",
      Comments: "Dummy preauth request.",
    };
    for (const [id, value] of Object.entries(values)) {
      const input = field(id);
      if (!(await input.count().catch(() => 0))) continue;
      const written = await input.evaluate((element, next) => {
        if (element.type === "hidden") return "";
        element.disabled = false;
        element.readOnly = false;
        element.removeAttribute("readonly");
        element.removeAttribute("disabled");
        const max = Number(element.getAttribute("maxlength") || 0);
        const text = max > 0 ? String(next).slice(0, max) : String(next);
        element.value = text;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return element.value;
      }, value).catch(() => "");
      if (written) report.filled.push(`${id}=${written}`);
    }

    const diagnosis = field("ddlDiagnosis_Type");
    if (await diagnosis.count().catch(() => 0)) {
      const diagnosisLabel = "Type 2 diabetes mellitus without complications(E119)";
      await diagnosis.evaluate((element) => {
        const input = window.jQuery(element);
        input.val("diab");
        input.autocomplete("search", "diab");
      });
      await page.waitForFunction((label) => {
        const menu = window.jQuery("#ddlDiagnosis_Type").autocomplete("widget");
        return menu.is(":visible") && menu.find("li").filter(function () {
          return window.jQuery(this).text().trim() === label;
        }).length > 0;
      }, diagnosisLabel, { timeout: 10000 });
      const chosen = await diagnosis.evaluate((element, label) => {
        const input = window.jQuery(element);
        const item = input.autocomplete("widget").find("li").filter(function () {
          return window.jQuery(this).text().trim() === label;
        }).first()[0];
        item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        item.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        element.blur();
        if (typeof Hide_disease_Diagnosis === "function") Hide_disease_Diagnosis(element);
        input.removeClass("ui-autocomplete-loading");
        input.autocomplete("close");
        const hidden = document.getElementById("txtDiagnosis_Type_ID");
        return `${element.value}|${hidden ? hidden.value : ""}`;
      }, diagnosisLabel);
      if (!chosen.startsWith(`${diagnosisLabel}|`) || chosen.endsWith("|")) {
        throw new Error("Diagnosis was not selected from the list.");
      }
      report.filled.push(`ddlDiagnosis_Type=${chosen}`);
    }

    await page.waitForFunction(() => {
      const select = document.querySelector("#ddlAccommodation");
      return Boolean(select && [...select.options].some((option) => option.value === "120192"));
    }, undefined, { timeout: 15000 }).catch(() => {});
    const accommodation = field("ddlAccommodation");
    if (await accommodation.count().catch(() => 0)) {
      const picked = await accommodation.evaluate((element) => {
        const option = [...element.options].find((item) => item.value === "120192");
        if (!option) return "";
        option.selected = true;
        element.value = option.value;
        return `${element.value}|${option.text.trim()}`;
      }).catch(() => "");
      if (picked) report.filled.push(`ddlAccommodation=${picked}`);
    }

    const file = field("btnBrowse2");
    if (await file.count().catch(() => 0)) {
      await file.setInputFiles("artifacts/dummy-claim.pdf");
      report.filled.push("file=dummy-claim.pdf");
    }

    report.submitted = false;
    report.stoppedAt = "form";
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
  return report;
}
