import { copyFile, writeFile } from "node:fs/promises";

// GitHub Pages has no server rewrites: serving index.html as 404.html makes
// deep links such as /adminpanel or /examen/B1 boot the SPA at the same URL.
await copyFile("dist/index.html", "dist/404.html");
await writeFile("dist/.nojekyll", "");
console.log("postbuild: dist/404.html + dist/.nojekyll written");
