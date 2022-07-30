const vite = require("vite");
const esbuild = require("esbuild");
const fs = require("fs");

fs.rmSync("dist", { force: true, recursive: true });
fs.mkdirSync("dist");

vite.build({
  build: {
    minify: false,
    outDir: "dist/public/",
    sourcemap: true,
  },
});

esbuild.build({
  external: ["mjml"],
  bundle: true,
  entryPoints: ["server/index.ts"],
  outfile: "dist/server.js",
  platform: "node",
  target: ["node16"],
  sourcemap: true,
});
