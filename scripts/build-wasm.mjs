import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const publicDir = path.join(projectRoot, "chess");
const srcFile = path.join(projectRoot, "src", "chess.c");
const distJs = path.join(distDir, "chess.js");
const distWasm = path.join(distDir, "chess.wasm");

function resolveEmccPath() {
  if (process.env.EMCC && existsSync(process.env.EMCC)) {
    return process.env.EMCC;
  }
  const emsdk = process.env.EMSDK;
  if (emsdk) {
    const candidate = path.join(emsdk, "upstream", "emscripten", process.platform === "win32" ? "emcc.bat" : "emcc");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "emcc";
}

function parseOptFlag() {
  const args = process.argv.slice(2);
  let value = "Os";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === "--opt" || arg === "-O") && args[i + 1]) {
      value = args[i + 1];
      i += 1;
    }
  }
  if (!value.startsWith("O")) {
    return `-O${value}`;
  }
  return `-${value}`;
}

function ensureArtifactsExist() {
  if (!existsSync(distJs) || !existsSync(distWasm)) {
    throw new Error("emcc did not emit chess.js/chess.wasm");
  }
}

function main() {
  const optFlag = parseOptFlag();
  const emccPath = resolveEmccPath();
  mkdirSync(distDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  const emccArgs = [
    srcFile,
    optFlag,
    "-s", "WASM=1",
    "-s", "MODULARIZE=1",
    "-s", "EXPORT_ES6=1",
    "-s", "EXPORT_NAME=ChessModule",
    "-s", "ALLOW_MEMORY_GROWTH=1",
    "-s", "EXPORTED_FUNCTIONS=['_chess_reset','_chess_generate_moves','_chess_get_moves','_chess_random_ai','_chess_apply_move','_chess_get_board']",
    "-s", "EXPORTED_RUNTIME_METHODS=['cwrap','getValue','setValue','UTF8ToString']",
    "-o", distJs
  ];

  console.log(`[build] Running emcc with ${optFlag}`);
  const spawnArgs = process.platform === "win32"
    ? [process.env.ComSpec ?? "cmd.exe", ["/c", emccPath, ...emccArgs]]
    : [emccPath, emccArgs];
  const result = spawnSync(spawnArgs[0], spawnArgs[1], { stdio: "inherit" });
  if (result.status !== 0) {
    const message = result.error ? result.error.message : `emcc exited with status ${result.status}`;
    throw new Error(message);
  }

  ensureArtifactsExist();
  cpSync(distJs, path.join(publicDir, "chess.js"));
  cpSync(distWasm, path.join(publicDir, "chess.wasm"));
  console.log(`[build] Copied chess.js + chess.wasm to ${publicDir}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
