import { copyFile, readFile, writeFile } from "node:fs/promises";

// GitHub Pages cannot send security headers, so the production build ships a
// meta policy. Fonts and Supabase are the only external origins the app uses;
// inline styles are required by React's style attributes.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "form-action 'self'",
].join("; ");

const html = await readFile("dist/index.html", "utf8");
const meta = `    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n`;
const hardened = html.includes("Content-Security-Policy")
  ? html
  : html.replace("</head>", `${meta}  </head>`);

await writeFile("dist/index.html", hardened);
// Deep links such as /adminpanel must boot the same hardened document.
await copyFile("dist/index.html", "dist/404.html");
await writeFile("dist/.nojekyll", "");
console.log("postbuild: CSP + dist/404.html + dist/.nojekyll written");
