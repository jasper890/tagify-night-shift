// Broken-link check for this site. No dependencies.
//  1. Internal links (to="/..." and path: '/...') must match a real route.
//  2. External https:// links must answer with 2xx/3xx.
//     401/403/418/429 count as warnings (some sites block robots), anything else fails.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.(tsx?|mjs)$/.test(name) && !name.endsWith('.test.ts') ? [p] : []
  })
}

const files = walk(SRC)
const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')

// Routes from App.tsx and tool slugs from data/tools.ts
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8')
const staticRoutes = [...app.matchAll(/path="([^"*:]+)"/g)].map((m) => m[1])
const slugs = [...readFileSync(join(SRC, 'data', 'tools.ts'), 'utf8').matchAll(/slug: '([^']+)'/g)].map((m) => m[1])
const routes = new Set([...staticRoutes, ...slugs.map((s) => `/beyond/${s}`)])

const internal = new Set(
  [...text.matchAll(/(?:to|path|page|lesson)[=:]\s*[{]?["'`](\/[a-z0-9\-/]*)(?:#[^"'`]*)?["'`]/gi)].map((m) => m[1]).filter((p) => !p.includes('${')),
)
let failures = 0
let warnings = 0

for (const link of [...internal].sort()) {
  if (!routes.has(link)) {
    console.log(`FAIL internal  ${link}  (no matching route)`)
    failures++
  }
}
console.log(`Checked ${internal.size} internal links against ${routes.size} routes.`)

const external = [...new Set([...text.matchAll(/https:\/\/[^\s"'`<>)\\]+/g)].map((m) => m[0].replace(/[.,;]$/, '')))]
  // skip placeholder/example hosts used in sample code
  .filter((u) => !/example\.com|example\.a\.run\.app|\.lab\.local|123456789012|openapi\.vercel\.sh|\$\{/.test(u))
  .sort()

async function check(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (link checker for a student project)' },
    })
    return res.status
  } catch (err) {
    return `error: ${err.name === 'AbortError' ? 'timeout' : err.message}`
  } finally {
    clearTimeout(timer)
  }
}

const results = await Promise.all(external.map(async (u) => [u, await check(u)]))
for (const [url, status] of results) {
  if (typeof status === 'number' && status < 400) {
    console.log(`ok   ${status}  ${url}`)
  } else if ([401, 403, 418, 429].includes(status)) {
    console.log(`WARN ${status}  ${url}`)
    warnings++
  } else {
    console.log(`FAIL ${status}  ${url}`)
    failures++
  }
}

console.log(`\n${external.length} external links: ${failures} failed, ${warnings} warnings.`)
process.exit(failures ? 1 : 0)
