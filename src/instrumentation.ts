export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureRuntimeReady } = await import("@/lib/server/runtime");
    ensureRuntimeReady();
  }
}
