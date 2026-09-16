import { copyFileSync, rmSync } from "node:fs";

switch (process.argv[2]) {
  case "clean":
    rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
    rmSync(new URL("../types", import.meta.url), { recursive: true, force: true });
    break;
  case "license":
    copyFileSync(
      new URL("../../LICENSE", import.meta.url),
      new URL("../LICENSE", import.meta.url),
    );
    break;
  default:
    throw new Error("Expected build-files.js clean or license");
}
