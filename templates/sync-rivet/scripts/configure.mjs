// Bootstraps the local serverless pool. Hitting the registry's metadata endpoint
// triggers RivetKit to register the serverless provider with the engine so it
// can start actors on demand. Polls until the dev server is ready.
const port = process.env.PORT ?? "5173";
const url = `http://127.0.0.1:${port}/api/rivet/metadata`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let i = 0; i < 120; i++) {
	try {
		const res = await fetch(url);
		if (res.ok) {
			console.log("serverless pool configured");
			process.exit(0);
		}
	} catch {
		// Dev server not up yet.
	}
	await sleep(1000);
}

console.error(`timed out waiting for serverless configuration at ${url}`);
process.exit(1);
