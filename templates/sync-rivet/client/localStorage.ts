export function getLocalStorageItem(key: string): string | null {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

export function setLocalStorageItem(key: string, value: string): void {
	try {
		localStorage.setItem(key, value)
	} catch {
		// localStorage not available
	}
}

export function removeLocalStorageItem(key: string): void {
	try {
		localStorage.removeItem(key)
	} catch {
		// localStorage not available
	}
}
