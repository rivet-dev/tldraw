import { type RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import { createTLSchema, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema'
import throttle from 'lodash.throttle'
import { actor, setup } from 'rivetkit'
import type { ActorKv } from 'rivetkit'

const schema = createTLSchema({
	shapes: { ...defaultShapeSchemas },
})

// Snapshot key prefix. The snapshot is chunked across `${PREFIX}/c/N` keys with a
// `${PREFIX}/meta` count, because actor KV values are capped at 128 KiB.
const SNAPSHOT_PREFIX = 'snapshot'
const SNAPSHOT_CHUNK_SIZE = 96 * 1024

const tldrawRoom = actor({
	createVars: async (c) => {
		const initialSnapshot = await loadSnapshot(c.kv)

		const persistSnapshot = throttle(() => {
			// Best-effort, fire-and-forget; never let a KV error become an
			// unhandled rejection.
			void saveSnapshot(c.kv, room).catch((error) => {
				console.error('[tldraw] failed to persist snapshot', error)
			})
		}, 1_000)

		const room = new TLSocketRoom<TLRecord, void>({
			schema,
			initialSnapshot,
			onDataChange: persistSnapshot,
		})

		return { room, persistSnapshot }
	},
	onSleep: async (c) => {
		c.vars.persistSnapshot.cancel()
		try {
			await saveSnapshot(c.kv, c.vars.room)
		} catch (error) {
			console.error('[tldraw] failed to flush snapshot on sleep', error)
		}
	},
	onWebSocket: async (c, websocket) => {
		if (!c.request) {
			websocket.close(1008, 'Missing request')
			return
		}

		const url = new URL(c.request.url)
		const sessionId = url.searchParams.get('sessionId')

		if (!sessionId) {
			websocket.close(1008, 'Missing sessionId')
			return
		}

		// Bridge the raw socket into the room. `handleSocketConnect` attaches its
		// own message and close listeners, so the handler returns once the socket
		// is wired up. Do not block here with a never-resolving promise: the
		// runtime runs onWebSocket in the background and the socket must be allowed
		// to signal open.
		c.vars.room.handleSocketConnect({
			sessionId,
			socket: websocket,
		})
	},
})

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function metaKey() {
	return textEncoder.encode(`${SNAPSHOT_PREFIX}/meta`)
}

function chunkKey(index: number) {
	return textEncoder.encode(`${SNAPSHOT_PREFIX}/c/${String(index).padStart(8, '0')}`)
}

async function readChunkCount(kv: ActorKv): Promise<number> {
	const meta = await kv.get(metaKey(), { type: 'binary' })
	if (!meta) return 0
	const count = Number.parseInt(textDecoder.decode(meta), 10)
	return Number.isFinite(count) && count > 0 ? count : 0
}

async function loadSnapshot(kv: ActorKv) {
	const count = await readChunkCount(kv)
	if (count === 0) return undefined

	const chunks = await kv.batchGet(Array.from({ length: count }, (_, i) => chunkKey(i)))
	const parts: Uint8Array[] = []
	for (const chunk of chunks) {
		if (chunk) parts.push(chunk)
	}

	const total = parts.reduce((sum, p) => sum + p.length, 0)
	const merged = new Uint8Array(total)
	let offset = 0
	for (const part of parts) {
		merged.set(part, offset)
		offset += part.length
	}

	return JSON.parse(textDecoder.decode(merged)) as RoomSnapshot
}

async function saveSnapshot(kv: ActorKv, room: TLSocketRoom<TLRecord, void>): Promise<void> {
	const bytes = textEncoder.encode(JSON.stringify(room.getCurrentSnapshot()))
	const count = Math.max(1, Math.ceil(bytes.length / SNAPSHOT_CHUNK_SIZE))
	const previousCount = await readChunkCount(kv)

	// Write chunks, then the meta count so a reader never sees a count whose
	// chunks have not all been written yet.
	for (let i = 0; i < count; i++) {
		const slice = bytes.slice(i * SNAPSHOT_CHUNK_SIZE, (i + 1) * SNAPSHOT_CHUNK_SIZE)
		await kv.put(chunkKey(i), slice)
	}
	await kv.put(metaKey(), textEncoder.encode(String(count)))

	// Remove stale chunks left over from a previously larger snapshot.
	for (let i = count; i < previousCount; i++) {
		await kv.delete(chunkKey(i))
	}
}

// Public URL the engine calls back to start serverless actors. In local dev this
// is the dev server itself; override with RIVET_SERVERLESS_URL when the engine
// reaches this app at a different address.
const serverlessUrl = process.env.RIVET_SERVERLESS_URL ?? 'http://127.0.0.1:5173/api/rivet'

export const registry = setup({
	use: { tldrawRoom },
	// Self-register the serverless pool so the engine can start actors on demand.
	configurePool: { url: serverlessUrl },
})
