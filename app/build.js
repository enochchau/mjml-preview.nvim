const vite = require("vite");
const cp = require("child_process");
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
  logLevel: "info",
  external: ["uglify-js"],
  bundle: true,
  entryPoints: ["server/index.ts"],
  outfile: "dist/server.js",
  platform: "node",
  target: ["node16"],
  sourcemap: true,
});

fs.copyFileSync("build_artifacts/package.json", "dist/package.json");
fs.copyFileSync("build_artifacts/package-lock.json", "dist/package-lock.json");

cp.execSync("cd dist && npm install", { stdio: "inherit" });
