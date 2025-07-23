import { runWorkerLoop } from './worker';

/**
 * Starts the background worker loop, processing calls at regular intervals.
 * make sure to run `npm run worker` to start the worker.
 */
async function run(): Promise<void> {
    console.log('Worker started...');

    setInterval(async () => {
        try {
            await runWorkerLoop();
        } catch (err) {
            const error = err as Error;
            console.error('Worker loop error:', error.message);
        }
    }, 2000); // every 2 seconds
}

run().catch((err: unknown) => {
    const error = err as Error;
    console.error('Worker failed to start:', error.message);
    process.exit(1);
});
