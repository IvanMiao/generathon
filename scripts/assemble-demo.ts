import { runDemoAssembly } from "../src/lib/server/deterministic-assembly.ts";

const snapshot = runDemoAssembly(process.cwd());
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
