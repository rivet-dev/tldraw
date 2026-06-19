import { useSync } from '@tldraw/sync'
import { ReactNode, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from 'rivetkit/client'
import { Tldraw } from 'tldraw'
import { getBookmarkPreview } from '../getBookmarkPreview'
import { multiplayerAssetStore } from '../multiplayerAssetStore'

const client = createClient()

export function Room() {
	const { roomId } = useParams<{ roomId: string }>()
	const [roomUri, setRoomUri] = useState<string | undefined>(undefined)

	useEffect(() => {
		const loadRoomUri = async () => {
			const gatewayUrl = await client.tldrawRoom.getOrCreate(roomId!).getGatewayUrl()
			// The gateway URL is query-backed (ends with ?rvt-* params), so splice
			// the /websocket path segment into the pathname rather than appending it,
			// which would otherwise bury it inside the final query value.
			const url = new URL(gatewayUrl)
			url.pathname = `${url.pathname.replace(/\/$/, '')}/websocket`
			setRoomUri(url.toString())
		}

		if (roomId) {
			loadRoomUri()
		}
	}, [roomId])

	if (!roomUri || !roomId) {
		return (
			<RoomWrapper roomId={roomId}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						height: '100%',
					}}
				>
					Loading room...
				</div>
			</RoomWrapper>
		)
	}

	return <ConnectedRoom roomId={roomId} roomUri={roomUri} />
}

function ConnectedRoom({ roomId, roomUri }: { roomId: string; roomUri: string }) {
	const store = useSync({
		uri: roomUri,
		assets: multiplayerAssetStore,
	})

	return (
		<RoomWrapper roomId={roomId}>
			<Tldraw
				store={store}
				options={{ deepLinks: true }}
				onMount={(editor) => {
					editor.registerExternalAssetHandler('url', getBookmarkPreview)
				}}
			/>
		</RoomWrapper>
	)
}

function RoomWrapper({ children, roomId }: { children: ReactNode; roomId?: string }) {
	const [didCopy, setDidCopy] = useState(false)

	useEffect(() => {
		if (!didCopy) return
		const timeout = setTimeout(() => setDidCopy(false), 3000)
		return () => clearTimeout(timeout)
	}, [didCopy])

	return (
		<div className="RoomWrapper">
			<div className="RoomWrapper-header">
				<WifiIcon />
				<div>{roomId}</div>
				<button
					className="RoomWrapper-copy"
					onClick={() => {
						navigator.clipboard.writeText(window.location.href)
						setDidCopy(true)
					}}
					aria-label="copy room link"
				>
					Copy link
					{didCopy && <div className="RoomWrapper-copied">Copied!</div>}
				</button>
			</div>
			<div className="RoomWrapper-content">{children}</div>
		</div>
	)
}

function WifiIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth="1.5"
			stroke="currentColor"
			width={16}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
			/>
		</svg>
	)
}
