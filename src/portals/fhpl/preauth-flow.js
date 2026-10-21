async page => {
  const submitWithFinalBill = true;
  const report = { filled: [], errors: [], saved: false, stoppedAt: "" };
  const patient = "#ContentPlaceHolder1_TabContainer1_tbPatientDetails_";
  const hospital = "#ContentPlaceHolder1_TabContainer1_tbHospitalizationDetails_";
  const billing = "#ContentPlaceHolder1_TabContainer1_tbBillingDetails_";
  const frame = () => page.frames().find((item) => /PreauthRequest/i.test(item.url())) ?? page.mainFrame();

  const until = async (read, timeout = 15000) => {
    const started = Date.now();
    let latest = "";
    while (Date.now() - started < timeout) {
      latest = await read().catch(() => "");
      if (latest) return latest;
      await page.waitForTimeout(400);
    }
    return latest;
  };

  try {
    await frame().locator(`${patient}ddlInsuranceCompany`).selectOption({ label: "Oriental Insurance Co. Ltd" });
    await frame().locator(`${patient}txtCorporateName`).fill("Abbott Healthcare Pvt Ltd : Health Care Solutions");
    await frame().locator(`${patient}txtEmployeeID`).fill("732617");
    await frame().locator(`${patient}Button3`).click();
    const patientName = await until(() => frame().locator(`${patient}txtPatientName`).inputValue());
    if (!patientName) throw new Error("Employee lookup did not fill the patient name.");
    report.patientName = patientName;
    report.filled.push("patient-details=lookup");
    await frame().locator(`${patient}btnPatientDetailsNext`).click();

    await frame().locator(`${hospital}txtHospitalDoctorName`).waitFor({ state: "visible" });
    await frame().locator(`${hospital}txtHospitalDoctorName`).fill("Dr Dummy Physician");
    await frame().locator(`${hospital}txtDoctorMobile`).fill("9811111111");
    await frame().locator(`${hospital}txtDateOfAdmission`).evaluate((el) => {
      const jq = window.jQuery?.(el);
      if (jq?.datepicker) jq.datepicker("setDate", "22/10/2026");
      else {
        el.removeAttribute("readonly");
        el.value = "22/10/2026";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await frame().locator(`${hospital}ddlClassOfAccomodation`).selectOption({ label: "General" });
    await frame().locator(`${hospital}txtEstimatedDays`).fill("3");
    await frame().locator(`${hospital}txtPresentComplaint`).fill("Increased thirst and frequent urination for two days.");
    await frame().locator(`${hospital}txtPasthistoryofpresentAliment`).fill("Known diabetes mellitus. Dummy history for this request.");

    const diagnosis = frame().locator(`${hospital}txtPrimaryDiagnosis`);
    await diagnosis.click();
    await diagnosis.fill("");
    await diagnosis.pressSequentially("E11.65", { delay: 40 });
    const suggestion = frame().locator(".ui-menu-item, .ui-autocomplete li").filter({ hasText: "E11.65" }).first();
    await suggestion.waitFor({ state: "visible", timeout: 10000 });
    await suggestion.click();
    const icd = await until(() => frame().locator(`${hospital}txtICD10Code`).inputValue().then((value) => (value.includes("E11.65") ? value : "")));
    if (!icd.includes("E11.65")) throw new Error("Primary diagnosis E11.65 was not applied.");
    report.filled.push(`primary-diagnosis=${icd.trim()}`);

    await frame().locator(`${hospital}ddlProposedLineOfTreatment`).selectOption({ label: "Medical Management" });
    const procedureValue = await until(async () => {
      const value = await frame().locator(`${hospital}ddlProcedure`).evaluate((el) => {
        const option = [...el.options].find((item) => item.text.trim() === "DIABETES MELLITUS -TYPE2");
        return option?.value ?? "";
      });
      return value;
    });
    if (!procedureValue) throw new Error("Diabetes medical management option was not available.");
    await frame().locator(`${hospital}ddlProcedure`).selectOption({ value: procedureValue });
    const selectedProcedure = await until(() =>
      frame().locator(`${hospital}ddlProcedure`).evaluate((el) => {
        const text = el.options[el.selectedIndex]?.text?.trim() ?? "";
        return text.includes("DIABETES") ? text : "";
      }),
    );
    if (!selectedProcedure) throw new Error("Medical management procedure was not selected.");
    report.filled.push(`procedure=${selectedProcedure}`);

    await frame().locator(`${hospital}ddlRouteOfDrug`).selectOption({ label: "Oral" });
    await frame().locator(`${hospital}ddlAdmissionType`).selectOption({ label: "Planned" });
    await frame().locator(`${hospital}btnHospitalizationNext`).click();

    await frame().locator(`${billing}txtHypertension`).waitFor({ state: "visible" });
    const durations = [
      ["txtHypertension", "DDLMonths1", "0"],
      ["txtDiabetes", "DDLMonths2", "2"],
      ["txtIHD", "DDLMonths3", "0"],
      ["txtCOPD", "DDLCOPD", "0"],
      ["TxtCancer", "DDLCancer", "0"],
      ["txtAlcoholism", "DDLAlcoholism", "0"],
      ["TxtDug", "DDLDrug", "0"],
    ];
    for (const [textId, unitId, value] of durations) {
      await frame().locator(`${billing}${textId}`).fill(value);
      await frame().locator(`${billing}${unitId}`).selectOption({ label: "Years" });
    }
    await frame().locator(`${billing}DDLOther`).selectOption({ label: "No" });

    for (const [suffix, value] of [
      ["txtRoomNursingDiat", "3000"],
      ["txtConsultation", "500"],
      ["txtMedicinesConsumables", "1500"],
    ]) {
      const input = frame().locator(`${billing}${suffix}`);
      await input.fill(value);
      await input.evaluate((el) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(1200);
    }

    report.total = await frame().locator(`${billing}txtEstimatedCost`).inputValue();
    report.filled.push("billing-mandatory=filled");

    await frame().locator(`${billing}btnBillingDetails`).click();
    await frame().locator("#fupreauthForm").waitFor({ state: "visible" });
    const captureAlerts = () => {
      window.__fhplAlerts = window.__fhplAlerts || [];
      window.alert = (message) => {
        window.__fhplAlerts.push(String(message ?? ""));
      };
      window.confirm = () => true;
    };
    await page.addInitScript(captureAlerts);
    for (const item of page.frames()) {
      await item.evaluate(captureAlerts).catch(() => {});
    }
    const readAlerts = async () => {
      const messages = [];
      for (const item of page.frames()) {
        const found = await item
          .evaluate(() => {
            const list = window.__fhplAlerts || [];
            window.__fhplAlerts = [];
            return list;
          })
          .catch(() => []);
        messages.push(...found);
      }
      const problem = messages.find((message) => /fail|error|please upload|invalid|pdf file only/i.test(message));
      if (problem) throw new Error(problem);
      return messages;
    };
    const closePopup = async () => {
      const close = frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_DownloadpdfBack");
      if (await close.isVisible().catch(() => false)) await close.click();
    };
    const uploadPdf = async (fileId, buttonId) => {
      await frame().locator(`#${fileId}`).setInputFiles("artifacts/dummy-claim.pdf");
      await frame().locator(`#${buttonId}`).click();
      await page.waitForTimeout(800);
      await readAlerts();
      await closePopup();
    };
    await closePopup();
    const slots = [
      ["fupreauthForm", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnPreauthForm"],
      ["fuPatientIDProof", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnPatienIDProof"],
      ["fuInvestigationFile", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnInvestigationFile"],
      ["fuConsultantPapers", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnClncultantPapers"],
      ["fuInvestigation", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnInvetigation"],
      ["fuAadhar", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnAadhar"],
    ];
    for (const [fileId, buttonId] of slots) {
      await uploadPdf(fileId, buttonId);
    }
    report.filled.push("documents=dummy-claim.pdf");

    await frame().locator("#ddlPreauthCumFinal").selectOption({ label: submitWithFinalBill ? "Yes" : "No" });
    await page.waitForTimeout(1000);
    if (submitWithFinalBill) {
      await frame().locator("#FUFinal").waitFor({ state: "visible" });
      await uploadPdf("FUFinal", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_btnFinalbill");
      await uploadPdf("FUDischargeSummary", "ContentPlaceHolder1_TabContainer1_tbAddDocuments_BtnDischargeSummary");
      await frame().locator("#ContentPlaceHolder1_TabContainer1_tbAddDocuments_txtDODDate").evaluate((el) => {
        const jq = window.jQuery?.(el);
        if (jq?.datepicker) jq.datepicker("setDate", "25/10/2026");
        else {
          el.removeAttribute("readonly");
          el.value = "25/10/2026";
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      report.filled.push("final-bill=Yes", "dod=25/10/2026");
    } else {
      report.filled.push("final-bill=No");
    }
    report.submitted = false;
    report.stoppedAt = "Add Documents";
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
  return report;
}
