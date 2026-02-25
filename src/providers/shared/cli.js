import { spawn } from "node:child_process";

/**
 * Run a CLI command, passing data via stdin, reading result from stdout.
 * @param {Object} opts
 * @param {string} opts.command - The command to execute (first word is the binary, rest are base args)
 * @param {string[]} opts.args - Additional CLI arguments
 * @param {Buffer} opts.stdin - Data to pipe to stdin
 * @param {number} opts.timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} stdout output (trimmed)
 */
export async function runCliCommand({ command, args = [], stdin, timeoutMs = 120000 }) {
  // Split command string into binary + base args, then append extra args
  const parts = command.split(/\s+/).filter(Boolean);
  const bin = parts[0];
  const fullArgs = [...parts.slice(1), ...args];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, fullArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const stdout = [];
    const stderr = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();

      if (timedOut) {
        const e = new Error("CLI command timed out");
        e.statusCode = 504;
        return reject(e);
      }

      if (code !== 0) {
        const e = new Error(`CLI command failed (${code}): ${err || "no stderr"}`);
        e.statusCode = 502;
        return reject(e);
      }

      resolve(out);
    });

    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}
