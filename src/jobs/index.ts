import { runWorkerLoop } from './worker';

async function run() {
    console.log('Worker started...');
    setInterval(() => runWorkerLoop(), 2000);
}

run();
