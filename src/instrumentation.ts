// Background jobs (SPEC §10.10) run only in processes that ask for them.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_WORKERS === "true") {
    const { startWorkers } = await import("./server/services/console/analysis-jobs");
    await startWorkers();
  }
}
