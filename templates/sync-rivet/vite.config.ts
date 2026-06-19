import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, type Plugin } from 'vite'
import srvx from 'vite-plugin-srvx'

// Serve the vite-transformed index.html for client-side navigation requests (e.g.
// a hard load of `/:roomId`). vite-plugin-srvx only serves index.html for `/`,
// forwarding every other path to the server entry, which would 404 deep
// react-router routes. This runs before srvx so navigations never reach it, and
// uses transformIndexHtml so the React Refresh preamble is injected in dev.
function spaFallbackDev(): Plugin {
	return {
		name: 'tldraw-spa-fallback-dev',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url ?? '/'
				const path = url.split('?')[0]
				const isNavigation =
					req.method === 'GET' &&
					(req.headers.accept ?? '').includes('text/html') &&
					!path.startsWith('/api') &&
					!path.startsWith('/@') &&
					!/\.[a-zA-Z0-9]+$/.test(path)

				if (!isNavigation) return next()

				try {
					const template = readFileSync('index.html', 'utf-8')
					const html = await server.transformIndexHtml(url, template)
					res.statusCode = 200
					res.setHeader('content-type', 'text/html')
					res.end(html)
				} catch {
					next()
				}
			})
		},
	}
}

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		plugins: [
			spaFallbackDev(),
			react(
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_START */
				{ tsDecorators: true }
				/* EXCLUDE_FROM_TEMPLATE_EXPORT_END */
			),
			...srvx({ entry: 'server/server.ts' }),
		],
	}
})
