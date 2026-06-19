import { TLAssetStore, uniqueId } from 'tldraw'

// How does our server handle assets like images and videos?
export const multiplayerAssetStore: TLAssetStore = {
	// to upload an asset, we...
	async upload(_asset, file) {
		// ...create a unique name...
		const id = uniqueId()
		const objectName = `${id}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '-')

		// ...request a presigned upload URL from the server...
		const presignResponse = await fetch(`/api/uploads/${encodeURIComponent(objectName)}`, {
			method: 'POST',
			headers: {
				'Content-Type': file.type,
			},
		})

		if (!presignResponse.ok) {
			const error = await presignResponse.json().catch(() => ({}))
			throw new Error(error.error || `Failed to get upload URL: ${presignResponse.statusText}`)
		}

		const { url, objectName: finalObjectName } = await presignResponse.json()

		// ...upload directly to S3 using the presigned URL...
		const uploadResponse = await fetch(url, {
			method: 'PUT',
			body: file,
			headers: {
				'Content-Type': file.type,
			},
		})

		if (!uploadResponse.ok) {
			throw new Error(`Failed to upload asset to S3: ${uploadResponse.statusText}`)
		}

		// ...and return the URL to be stored with the asset record.
		// This URL will redirect to S3 when accessed.
		return { src: `/api/uploads/${encodeURIComponent(finalObjectName)}` }
	},

	// to retrieve an asset, we can just use the same URL. The server will
	// redirect to a presigned S3 URL for the actual download.
	resolve(asset) {
		return asset.props.src
	},
}
