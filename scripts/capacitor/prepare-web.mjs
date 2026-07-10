import { mkdir, writeFile } from "node:fs/promises";

const fallbackLiveUrl = "https://stockpilot-ai-beta.vercel.app";
const liveUrl = resolveLiveUrl(process.env.CAPACITOR_SERVER_URL ?? fallbackLiveUrl);
const liveUrlJson = JSON.stringify(liveUrl);
const liveUrlHtml = escapeHtml(liveUrl);
const outDir = new URL("../../out/", import.meta.url);
const indexFile = new URL("index.html", outDir);

function resolveLiveUrl(value) {
  const candidate = String(value || "").trim();

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") {
      throw new Error("CAPACITOR_SERVER_URL must use https.");
    }
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid CAPACITOR_SERVER_URL: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

await mkdir(outDir, { recursive: true });

await writeFile(
  indexFile,
  `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#07111f" />
    <title>StockPilot AI</title>
    <style>
      :root {
        color-scheme: dark;
        background: #07111f;
        color: #e5f3ff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        align-items: center;
        background:
          radial-gradient(circle at 20% 20%, rgba(42, 141, 255, 0.28), transparent 30rem),
          linear-gradient(135deg, #07111f 0%, #0d1728 50%, #050912 100%);
        display: flex;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }

      main {
        background: rgba(7, 17, 31, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 28px;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
        max-width: 420px;
        padding: 28px;
        text-align: center;
      }

      h1 {
        font-size: 28px;
        margin: 0 0 10px;
      }

      p {
        color: #a7b6ca;
        line-height: 1.5;
        margin: 0 0 18px;
      }

      a {
        background: #2f7df4;
        border-radius: 999px;
        color: white;
        display: inline-flex;
        font-weight: 700;
        padding: 12px 18px;
        text-decoration: none;
      }
    </style>
    <script>
      window.location.replace(${liveUrlJson});
    </script>
  </head>
  <body>
    <main>
      <h1>StockPilot AI</h1>
      <p>Die native App verbindet sich mit der sicheren Live-Version von StockPilot AI.</p>
      <a href="${liveUrlHtml}">App öffnen</a>
    </main>
  </body>
</html>
`
);

console.log(`Prepared Capacitor web shell in ${indexFile.pathname}`);
