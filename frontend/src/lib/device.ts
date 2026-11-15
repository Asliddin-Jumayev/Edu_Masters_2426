/** Brauzer uchun doimiy qurilma identifikatori. Backend yangi qurilmadan kirishni shu orqali aniqlaydi
 *  (localStorage tozalansa yoki boshqa brauzer ochilsa — yangi qurilma hisoblanadi). */
const KEY = 'em-device'
const VALID = /^[A-Za-z0-9_-]{16,64}$/

function generate(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function getDeviceId(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (v && VALID.test(v)) return v
    const id = generate()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return generate().padEnd(16, 'x') // localStorage yo'q (maxfiy rejim): har sessiyada yangi
  }
}
