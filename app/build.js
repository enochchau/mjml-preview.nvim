const cp = require("child_process");
const esbuild = require("esbuild");
const fs = require("fs");

fs.rmSync("dist", { force: true, recursive: true });
fs.mkdirSync("dist");

esbuild
  .build({
    logLevel: "info",
    bundle: true,
    entryPoints: ["src/index.ts"],
    outfile: "dist/public/assets/index.js",
    sourcemap: true,
  })
  .then(() => {
    fs.copyFileSync("index.html", "dist/public/index.html");
  });

esbuild.build({
  logLevel: "info",
  external: ["uglify-js"],
  bundle: true,
  entryPoints: ["server/index.ts"],
  outfile: "dist/server.js",
  platform: "node",
  target: ["node14"],
  sourcemap: true,
});
