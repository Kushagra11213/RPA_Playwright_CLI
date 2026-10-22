import { dispatch } from "../dispatcher.mjs";
import { createLogger } from "../shared/logger.mjs";
import { loadCredentialEntries, matchTpaCase } from "./match-portal.mjs";
import { createRpaClient } from "./rpa-client.mjs";

const log = createLogger("tpaflow");

function registrationId(request) {
  return String(request?.pmjayRegistrationId ?? "").trim();
}

export async function runApiBatch({
  client = createRpaClient(),
  dispatchImpl = dispatch,
  credentialEntries = loadCredentialEntries(),
} = {}) {
  log.info("Calling rpa-login.");
  await client.login();
  log.info("Calling rpa-requests.");
  const body = await client.fetchRequests();
  const requests = Array.isArray(body?.requests) ? body.requests : [];
  if (!requests.length) {
    log.info("rpa-requests returned no cases.");
    return { processed: 0, skipped: 0, failed: 0 };
  }

  const seen = new Set();
  const summary = { processed: 0, skipped: 0, failed: 0 };

  for (const request of requests) {
    const caseId = registrationId(request);
    if (!caseId) {
      summary.skipped += 1;
      log.warn("Skipping a case with no pmjayRegistrationId.");
      continue;
    }
    if (seen.has(caseId)) {
      summary.skipped += 1;
      log.warn(`Skipping duplicate case ${caseId}.`);
      continue;
    }
    seen.add(caseId);
    if (request.isTpa === false) {
      summary.skipped += 1;
      log.info(`Skipping non-TPA case ${caseId}.`);
      continue;
    }

    try {
      const documentType = String(request.documentType ?? "").trim() || "ADMISSIONDOCUMENT";
      const casePayload = await client.fetchCaseData(caseId, documentType);
      const match = matchTpaCase(casePayload, credentialEntries);
      if (!match.matched) {
        summary.skipped += 1;
        log.warn(`Skipping case ${caseId}: ${match.reason}`);
        continue;
      }
      log.info(`Case ${caseId} matched ${match.portal.id}.`);
      await dispatchImpl({
        tpaId: match.portal.id,
        credentials: match.credentials,
        caseData: casePayload.caseData,
      });
      summary.processed += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Case ${caseId} failed: ${message}`);
    }
  }

  log.info(`Batch finished. Processed ${summary.processed}, skipped ${summary.skipped}, failed ${summary.failed}.`);
  return summary;
}
