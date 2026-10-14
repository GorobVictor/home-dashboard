console.info("Worker started; no scheduled jobs are configured yet.");

const keepAlive = setInterval(() => {}, 60_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.info(`Worker stopping after ${signal}.`);
    clearInterval(keepAlive);
  });
}
