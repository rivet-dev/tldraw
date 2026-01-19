import { TLSocketRoom } from '@tldraw/sync-core'
import { createTLSchema, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema'
import { actor, setup, type UniversalWebSocket } from 'rivetkit'

const schema = createTLSchema({
	shapes: { ...defaultShapeSchemas },
})

const tldrawRoom = actor({
	state: {
		snapshot: null as any,
	},
	createVars: () => {
		return {
			room: undefined as TLSocketRoom<TLRecord, void> | undefined,
		}
	},
	actions: {
		getOrCreate: async () => {
			return { status: 'ok' }
		},
	},
	onWebSocket: async (c, websocket: UniversalWebSocket) => {
		if (!c.request) {
			websocket.close(1008, 'Missing request')
			return
		}

		const url = new URL(c.request.url)
		const clientId = url.searchParams.get('clientId')

		if (!clientId) {
			websocket.close(1008, 'Missing clientId')
			return
		}

		if (!c.vars.room) {
			const initialSnapshot = c.state.snapshot || undefined
			c.vars.room = new TLSocketRoom<TLRecord, void>({
				schema,
				initialSnapshot,
			})
		}

		c.vars.room.handleSocketConnect({
			sessionId: clientId,
			socket: websocket,
		})
	},
})

export const registry = setup({
	use: { tldrawRoom },
})
