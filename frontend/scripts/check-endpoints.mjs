// Frontend chaqiradigan har bir API yo'l va metod backend OpenAPI sxemasida borligini tekshiradi.
// Ishlatish: npm run check:endpoints  (backend o'zgarsa avval: npm run gen:api, openapi.json ni yangilang)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const spec = JSON.parse(readFileSync(fileURLToPath(new URL('../openapi.json', import.meta.url))))
const norm = (p) => p.replace(/\{[^}]*\}/g, '{}').replace(/\$\{[^}]*\}/g, '{}')
const api = new Map(Object.entries(spec.paths).map(([p, ops]) => [norm(p), new Set(Object.keys(ops))]))
const segs = new Set([...api.keys()].map((p) => p.split('/')[1]))

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') ? [p] : []
  });
}
const SKIP = new Set(['App.tsx', 'nav.ts'])
const METHOD = { get: 'get', list: 'get', download: 'get', post: 'post', upload: 'post', put: 'put', patch: 'patch', del: 'delete' }
const callRe = /(?:api\.(get|post|put|patch|del|upload|list|download)|(useGet|useOptions))(?:<[^()]*?>)?\(\s*([`'"])([^`'"]*)\3/g
const litRe = /(['"`])(\/[a-z][^'"`\n]*)\1/g

const errors = []
let calls = 0, lits = 0
for (const file of walk(fileURLToPath(new URL('../src', import.meta.url)))) {
  const src = readFileSync(file, 'utf8')
  const name = basename(file)
  for (const m of src.matchAll(callRe)) {
    calls++
    const path = norm(m[4].split('?')[0])
    if (path.startsWith('{}')) continue // dinamik yo'l (masalan ${cfg.endpoint}${id}) — statik tekshirib bo'lmaydi
    const method = m[1] ? METHOD[m[1]] : 'get'
    const ops = api.get(path)
    if (!ops) errors.push(`${name}: yo'l backendda yo'q -> ${m[4]}`)
    else if (!ops.has(method)) errors.push(`${name}: ${method.toUpperCase()} ${m[4]} yo'q (bor: ${[...ops].join(',').toUpperCase()})`)
  }
  if (SKIP.has(name)) continue
  for (const m of src.matchAll(litRe)) {
    const first = m[2].split('/')[1]
    if (!segs.has(first)) continue
    lits++
    const path = norm(m[2].split('?')[0])
    // 'endpoint + id' (oxiri / bilan) yoki to'liq yo'l
    const isPrefix = [...api.keys()].some((k) => k.startsWith(path)) // kesh yangilash prefikslari: '/reports/', '/sms/'
    if (!api.has(path) && !isPrefix) errors.push(`${name}: noma'lum yo'l -> ${m[2]}`)
  }
}
console.log(`Tekshirildi: ${calls} ta API chaqiruvi (yo'l + metod), ${lits} ta yo'l literali. Backendda ${api.size} ta yo'l.`)
if (errors.length) { console.error('\nXATOLAR:\n - ' + [...new Set(errors)].join('\n - ')); process.exit(1) }
console.log('Hammasi backend sxemasiga mos ✔')
