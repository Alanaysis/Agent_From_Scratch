import { cwd } from "process";
import { pathToFileURL } from "url";
import { runHeadless } from "./headless";
import { startRepl } from "./repl";
import { startTui } from "./tui";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const autoApprove = argv.includes("--yes");
  const streamOutput = argv.includes("--stream")
    ? true
    : argv.includes("--no-stream")
      ? false
      : undefined;
  const filteredArgs = argv.filter(
    (arg) => arg !== "--yes" && arg !== "--stream" && arg !== "--no-stream",
  );

  if (filteredArgs.length === 0 || filteredArgs[0] === "tui") {
    await startTui({
      cwd: cwd(),
      autoApprove,
    });
    return;
  }

  if (filteredArgs[0] === "repl") {
    await startRepl({
      cwd: cwd(),
      autoApprove,
    });
    return;
  }

  await runHeadless({
    cwd: cwd(),
    args: filteredArgs,
    autoApprove,
    streamOutput,
  });
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
