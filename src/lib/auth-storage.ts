export function clearAuthStorage(): void {
  sessionStorage.clear()
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('sb-') || /token/i.test(key))) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
}
