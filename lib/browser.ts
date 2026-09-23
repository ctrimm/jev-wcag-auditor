/** Headless Chromium for audits and PDF rendering.
 *
 * In this sandbox, outbound traffic must go through the local CONNECT
 * forwarder (127.0.0.1:18080) that injects Proxy-Authorization; direct
 * egress fails. In production (no forwarder listening) we go direct.
 *
 * The sandbox also has its own Chrome build; elsewhere (e.g. the GitHub
 * Action) we fall back to Playwright's bundled Chromium — override the
 * path with AUDIT_CHROME_PATH.
 */
import fs from "node:fs";
import net from "node:net";
import { chromium, type Browser } from "playwright";

const CHROME = process.env.AUDIT_CHROME_PATH || "/home/hatch/workspace/tooling/chrome-linux64/chrome";
const PROXY = "http://127.0.0.1:18080";

function proxyListening(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect(18080, "127.0.0.1");
    s.once("connect", () => { s.end(); resolve(true); });
    s.once("error", () => resolve(false));
    setTimeout(() => { s.destroy(); resolve(false); }, 1500);
  });
}

export async function launchAuditBrowser(): Promise<Browser> {
  const useProxy = await proxyListening();
  const args = ["--no-sandbox", "--disable-dev-shm-usage"];
  if (useProxy) args.push(`--proxy-server=${PROXY}`, "--ignore-certificate-errors");
  const opts: Parameters<typeof chromium.launch>[0] = { args };
  // Sandbox Chrome when present; otherwise Playwright's bundled Chromium
  // (the GitHub Action installs it via `playwright install chromium`).
  if (CHROME && fs.existsSync(CHROME)) opts.executablePath = CHROME;
  return chromium.launch(opts);
}

/** Ensure the local proxy forwarder is running (sandbox only). No-op when
 *  something already listens on 18080 or the forwarder script is absent. */
export async function ensureProxyForwarder(): Promise<void> {
  if (await proxyListening()) return;
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  const fwd = "/home/hatch/workspace/jev-ultrafast/proxy_forwarder.py";
  if (!fs.existsSync(fwd)) return;
  const child = spawn("/usr/bin/python3", [fwd], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  // Poll until the forwarder actually accepts connections (fixed sleeps race
  // with slow starts and produce silent Chrome error pages).
  for (let i = 0; i < 30; i++) {
    if (await proxyListening()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Proxy forwarder did not start listening on 127.0.0.1:18080.");
}
