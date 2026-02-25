import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function createAuditLogger(config) {
  return {
    log(event) {
      const file = config.privacy?.auditLogFile;
      if (!file) return;

      const line = JSON.stringify({
        ts: new Date().toISOString(),
        ...event,
      });
      const fullPath = resolve(process.cwd(), file);
      mkdirSync(dirname(fullPath), { recursive: true });
      appendFileSync(fullPath, line + "\n");
    },
  };
}

