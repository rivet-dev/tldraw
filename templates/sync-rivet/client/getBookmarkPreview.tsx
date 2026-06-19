import { AssetRecordType, TLAsset, TLBookmarkAsset, getHashForString } from 'tldraw'

export async function getBookmarkPreview({ url }: { url: string }): Promise<TLAsset> {
	const asset: TLBookmarkAsset = {
		id: AssetRecordType.createId(getHashForString(url)),
		typeName: 'asset',
		type: 'bookmark',
		meta: {},
		props: {
			src: url,
			description: '',
			image: '',
			favicon: '',
			title: '',
		},
	}

	try {
		const response = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
		const data: any = await response.json()

		asset.props.description = data?.description ?? ''
		asset.props.image = data?.image ?? ''
		asset.props.favicon = data?.favicon ?? ''
		asset.props.title = data?.title ?? ''
	} catch {
		// Failed to fetch preview data, return asset with default values
	}

	return asset
}
