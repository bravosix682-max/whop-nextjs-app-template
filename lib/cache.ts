type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
	key: string,
	ttlMs: number,
	load: () => Promise<T>,
): Promise<T> {
	const hit = store.get(key) as Entry<T> | undefined;
	if (hit && hit.expires > Date.now()) return hit.value;
	const value = await load();
	store.set(key, { value, expires: Date.now() + ttlMs });
	if (store.size > 800) {
		const oldest = store.keys().next().value;
		if (oldest !== undefined) store.delete(oldest);
	}
	return value;
}

export function forget(key: string) {
	store.delete(key);
}

// True the first time inside the time window, false after that.
export function claim(key: string, ms: number): boolean {
	const hit = store.get(key);
	if (hit && hit.expires > Date.now()) return false;
	store.set(key, { value: true, expires: Date.now() + ms });
	return true;
}