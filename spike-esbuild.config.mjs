// spike-esbuild.config.mjs — throwaway
import esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["spike-plugin.ts"],
    bundle: true,
    format: "cjs",
        target: "es2022",
        external: ["obsidian"],
        outfile: "~/Documents/Test Vault/.obsidian/plugins/spike-sqlite-wasm/main.js",
        loader: { ".wasm": "base64" },
});
