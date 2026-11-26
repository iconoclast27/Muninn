// esbuild.config.mjs — Muninn plugin bundle
import esbuild from "esbuild";
import process from "node:process";

const prod = process.argv.includes("production");

const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "cjs",
    target: "es2022",
    platform: "browser",
    external: ["obsidian", "crypto", "fs", "path", "os", "module", "node:*"],
    outfile: "main.js",
    loader: { ".wasm": "base64" },
    sourcemap: prod ? false : "inline",
    minify: prod,
    logLevel: "info",
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
