export class AutomationError extends Error {
  constructor(message, { code = "AUTOMATION_ERROR", cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "AutomationError";
    this.code = code;
  }
}
