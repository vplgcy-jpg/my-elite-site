/* Bundle the vite build into one self-contained HTML fragment for publishing.
   The artifact host supplies the doctype/head/body skeleton, so we emit only
   the page content: title, styles, root node, and the inlined JS bundle. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const js = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
if (js.length !== 1) throw new Error(`expected one bundle, got: ${js.join(", ")}`);
const bundle = readFileSync(`dist/assets/${js[0]}`, "utf8");

// A literal </script> inside the inlined bundle would end the tag early.
// esbuild escapes these in strings, so a hit here is a real stop-the-press.
if (/<\/script/i.test(bundle)) throw new Error("bundle contains </script — cannot inline safely");

const html = `<meta charset="utf-8" />\n<title>Saiyan Journal</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23080908'/%3E%3Crect x='4' y='14' width='24' height='4' fill='%23CDF032'/%3E%3Crect x='2' y='10' width='4' height='12' fill='%23E9EEDD'/%3E%3Crect x='26' y='10' width='4' height='12' fill='%23E9EEDD'/%3E%3C/svg%3E" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#080908" />
<style>
  /* The app commits to one dark world by design - a gym phone screen.
     Ground painted explicitly so the page holds on any host background. */
  html, body { margin: 0; padding: 0; background: #080908; }
  * { -webkit-tap-highlight-color: transparent; }
  body { overscroll-behavior-y: none; }
  input, button { font-family: inherit; }
  button:focus-visible, input:focus-visible { outline: 2px solid #CDF032; outline-offset: 2px; }
</style>
<div id="root"></div>
<script type="module">
${bundle}
</script>
`;
writeFileSync("dist/artifact.html", html);
console.log(`dist/artifact.html · ${(html.length / 1024).toFixed(0)} KB`);
