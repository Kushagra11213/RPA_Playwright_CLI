import { dispatch } from "../dispatcher.mjs";
import { createLogger } from "../shared/logger.mjs";
import { loadCredentialEntries, matchTpaCase } from "./match-portal.mjs";
import { createRpaClient } from "./rpa-client.mjs";

const log = createLogger("tpaflow");

export const POLL_INTERVAL_MS = 30_000;

function registrationId(request) {
  return String(request?.pmjayRegistrationId ?? "").trim();
}

function wait(ms, shouldStop) {
  const step = 250;
  return new Promise((resolve) => {
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += step;
      if (shouldStop() || elapsed >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, step);
  });
}

async function processRequests({ client, dispatchImpl, credentialEntries, requests, seen, summary, shouldStop }) {
  if (!requests.length) {
    log.info("rpa-requests returned no cases.");
    return;
  }

  const seenThisPoll = new Set();
  let newCases = 0;

  for (const request of requests) {
    if (shouldStop()) break;
    const caseId = registrationId(request);
    if (!caseId) {
      summary.skipped += 1;
      log.warn("Skipping a case with no pmjayRegistrationId.");
      continue;
    }
    if (seen.has(caseId)) {
      if (seenThisPoll.has(caseId)) {
        summary.skipped += 1;
        log.warn(`Skipping duplicate case ${caseId}.`);
      }
      continue;
    }
    seen.add(caseId);
    seenThisPoll.add(caseId);
    newCases += 1;
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

  if (newCases === 0) {
    log.info("No new cases.");
  }
}

export async function runApiBatch({
  client = createRpaClient(),
  dispatchImpl = dispatch,
  credentialEntries = loadCredentialEntries(),
  pollIntervalMs = POLL_INTERVAL_MS,
  maxPolls = Infinity,
  shouldStop = () => false,
  sleep = wait,
} = {}) {
  const seconds = Math.round(pollIntervalMs / 1000);
  log.info(`Watching for new cases every ${seconds} seconds. Stop with Ctrl+C.`);

  const seen = new Set();
  const summary = { processed: 0, skipped: 0, failed: 0 };

  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (shouldStop()) break;
    try {
      if (poll === 0) log.info("Calling rpa-login.");
      await client.login();
      log.info("Calling rpa-requests.");
      const body = await client.fetchRequests();
      const requests = Array.isArray(body?.requests) ? body.requests : [];
      await processRequests({ client, dispatchImpl, credentialEntries, requests, seen, summary, shouldStop });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Case check failed: ${message}`);
    }

    const lastPoll = poll + 1 >= maxPolls;
    if (lastPoll || shouldStop()) break;
    log.info(`Checking again in ${seconds} seconds.`);
    await sleep(pollIntervalMs, shouldStop);
  }

  log.info(`Stopped. Processed ${summary.processed}, skipped ${summary.skipped}, failed ${summary.failed}.`);
  return summary;
}
