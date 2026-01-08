import { runJobsOnce, POLL_INTERVAL_MS } from "@/lib/jobs";

async function main() {
  // eslint-disable-next-line no-console
  console.log(`[worker] started. poll=${POLL_INTERVAL_MS}ms`);

  // process a small batch each tick
  while (true) {
    try {
      const r = await runJobsOnce(3);
      if (r.processed > 0) {
        // eslint-disable-next-line no-console
        console.log(`[worker] processed=${r.processed} done=${r.done} requeued=${r.requeued} failed=${r.failed}`);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(`[worker] error`, e);
    }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

void main();
