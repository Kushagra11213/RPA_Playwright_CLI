function stamp(level, scope, message) {
  const time = new Date().toISOString();
  return `[${time}] ${level} ${scope}: ${message}`;
}

export function createLogger(scope) {
  return {
    info(message) {
      console.log(stamp("INFO", scope, message));
    },
    error(message) {
      console.error(stamp("ERROR", scope, message));
    },
  };
}
