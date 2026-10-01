import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Files = Record<string, string>

function write(root: string, files: Files): void {
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

function gitIn(home: string, cwd: string): (...args: string[]) => void {
  return (...args) =>
    execFileSync('git', args, {
      cwd,
      stdio: 'ignore',
      env: {
        ...process.env,
        HOME: home,
        GIT_AUTHOR_DATE: '2026-09-28T10:12:00',
        GIT_COMMITTER_DATE: '2026-09-28T10:12:00',
      },
    })
}

interface Repo {
  name: string
  branch: string
  commits: { message: string; files: Files }[]
  working: Files
}

const INVOICES_BASE = `import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { invoices } from '../db/schema'
import { toMinorUnits } from '../lib/money'
import { invoiceInput } from './schemas'

export const invoiceRoutes = new Hono()

invoiceRoutes.post('/', async (c) => {
  const input = invoiceInput.parse(await c.req.json())
  const [invoice] = await db
    .insert(invoices)
    .values({
      customerId: input.customerId,
      amount: toMinorUnits(input.amount, input.currency),
      currency: input.currency,
      dueAt: input.dueAt,
    })
    .returning()
  return c.json(invoice, 201)
})

invoiceRoutes.get('/:id', async (c) => {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, c.req.param('id')))
  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  return c.json(invoice)
})
`

const INVOICES_CHANGED = `import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { invoices } from '../db/schema'
import { findReplay, storeReplay } from '../lib/idempotency'
import { toMinorUnits } from '../lib/money'
import { invoiceInput } from './schemas'

export const invoiceRoutes = new Hono()

invoiceRoutes.post('/', async (c) => {
  const key = c.req.header('Idempotency-Key')
  const body = await c.req.json()
  if (key) {
    const replay = await findReplay(key, body)
    if (replay === 'conflict') {
      return c.json({ error: 'Idempotency-Key was used with a different request' }, 409)
    }
    if (replay) return c.json(replay, 200)
  }
  const input = invoiceInput.parse(body)
  const [invoice] = await db
    .insert(invoices)
    .values({
      customerId: input.customerId,
      amount: toMinorUnits(input.amount, input.currency),
      currency: input.currency,
      dueAt: input.dueAt,
    })
    .returning()
  if (key) await storeReplay(key, body, invoice)
  return c.json(invoice, 201)
})

invoiceRoutes.get('/:id', async (c) => {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, c.req.param('id')))
  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  return c.json(invoice)
})
`

const INVOICE_TEST_BASE = `import { describe, expect, it } from 'vitest'
import { app } from '../src/server'

const draft = { customerId: 'cus_halden', amount: '1840.00', currency: 'EUR', dueAt: '2026-10-31' }

describe('POST /invoices', () => {
  it('creates an invoice in minor units', async () => {
    const response = await app.request('/invoices', { method: 'POST', body: JSON.stringify(draft) })
    expect(response.status).toBe(201)
    expect((await response.json()).amount).toBe(184000)
  })
})
`

const INVOICE_TEST_CHANGED = `${INVOICE_TEST_BASE.trimEnd().slice(0, -2)}
  it('replays the stored invoice for a repeated key', async () => {
    const send = () =>
      app.request('/invoices', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'retry-7f3a' },
        body: JSON.stringify(draft),
      })
    const first = await (await send()).json()
    const second = await send()
    expect(second.status).toBe(200)
    expect((await second.json()).id).toBe(first.id)
  })

  it('refuses a key reused with a different body', async () => {
    const send = (amount: string) =>
      app.request('/invoices', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'retry-91c0' },
        body: JSON.stringify({ ...draft, amount }),
      })
    await send('1840.00')
    expect((await send('99.00')).status).toBe(409)
  })
})
`

const IDEMPOTENCY = `import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { idempotencyKeys } from '../db/schema'

function fingerprint(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex')
}

export async function findReplay(key: string, body: unknown): Promise<unknown | 'conflict' | null> {
  const [row] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key))
  if (!row) return null
  return row.fingerprint === fingerprint(body) ? row.response : 'conflict'
}

export async function storeReplay(key: string, body: unknown, response: unknown): Promise<void> {
  await db.insert(idempotencyKeys).values({ key, fingerprint: fingerprint(body), response })
}
`

const MIGRATION = `create table idempotency_keys (
  key text primary key,
  fingerprint text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create index idempotency_keys_created_at on idempotency_keys (created_at);
`

const WEB_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoices · Marlow</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font: 13px/1.45 system-ui, sans-serif; color: #1b1f24; background: #f7f8fa; display: grid; grid-template-columns: 124px minmax(0, 1fr); max-width: 572px; min-height: 100vh; }
      nav { background: #fff; border-right: 1px solid #e3e6ea; padding: 18px 8px; }
      nav strong { display: block; padding: 0 10px 16px; font-size: 15px; letter-spacing: -0.01em; }
      nav a { display: block; padding: 7px 10px; border-radius: 6px; color: #4d5661; text-decoration: none; }
      nav a[aria-current] { background: #eef1f4; color: #1b1f24; font-weight: 600; }
      main { padding: 20px 18px; min-width: 0; }
      header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
      h1 { font-size: 20px; margin: 0; letter-spacing: -0.02em; }
      button { font: inherit; font-weight: 600; padding: 7px 12px; border-radius: 7px; border: 0; background: #1b1f24; color: #fff; }
      .totals { display: flex; gap: 22px; margin-bottom: 18px; color: #4d5661; }
      .totals b { display: block; color: #1b1f24; font-size: 18px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e6ea; border-radius: 10px; overflow: hidden; table-layout: fixed; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eef0f3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      th { font-size: 12px; font-weight: 600; color: #6a737e; background: #fafbfc; }
      tr:last-child td { border-bottom: 0; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
      .paid { background: #e3f4e8; color: #1a6b35; }
      .open { background: #e8eefb; color: #2450a6; }
      .late { background: #fbe6e3; color: #a3321f; }
      .draft { background: #eef0f3; color: #4d5661; }
    </style>
  </head>
  <body>
    <nav>
      <strong>Marlow</strong>
      <a href="#">Overview</a>
      <a href="#" aria-current="page">Invoices</a>
      <a href="#">Customers</a>
      <a href="#">Payouts</a>
      <a href="#">Settings</a>
    </nav>
    <main>
      <header><h1>Invoices</h1><button id="new">New invoice</button></header>
      <div class="totals">
        <div><b>€48,210.00</b>Outstanding</div>
        <div><b>€6,430.00</b>Overdue</div>
        <div><b id="count">8</b>Invoices</div>
      </div>
      <table>
        <thead><tr><th style="width:22%">Number</th><th>Customer</th><th style="width:21%">Status</th><th class="num" style="width:24%">Amount</th></tr></thead>
        <tbody id="rows">
          <tr><td>INV-2041</td><td>Northgate Logistics</td><td><span class="tag open">Open</span></td><td class="num">€12,480.00</td></tr>
          <tr><td>INV-2040</td><td>Halden &amp; Voss Architects</td><td><span class="tag open">Open</span></td><td class="num">€1,840.00</td></tr>
          <tr><td>INV-2039</td><td>Brightwater Clinics</td><td><span class="tag paid">Paid</span></td><td class="num">€9,300.00</td></tr>
          <tr><td>INV-2038</td><td>Oakline Studio</td><td><span class="tag late">Overdue</span></td><td class="num">€6,430.00</td></tr>
          <tr><td>INV-2037</td><td>Ferro Tooling</td><td><span class="tag paid">Paid</span></td><td class="num">€3,115.50</td></tr>
          <tr><td>INV-2036</td><td>Meridian Freight Partners</td><td><span class="tag open">Open</span></td><td class="num">€27,460.00</td></tr>
          <tr><td>INV-2035</td><td>Castell Foods</td><td><span class="tag paid">Paid</span></td><td class="num">€4,220.00</td></tr>
          <tr><td>INV-2034</td><td>Tamsin Labs</td><td><span class="tag paid">Paid</span></td><td class="num">€780.00</td></tr>
        </tbody>
      </table>
    </main>
    <script>
      document.getElementById('new').addEventListener('click', () => {
        const row = document.createElement('tr')
        row.innerHTML = '<td>INV-2042</td><td>New customer</td><td><span class="tag draft">Draft</span></td><td class="num">€0.00</td>'
        document.getElementById('rows').prepend(row)
        document.getElementById('count').textContent = String(document.querySelectorAll('#rows tr').length)
      })
    </script>
  </body>
</html>
`

const WEB_SERVER = `import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const page = new URL('./public/invoices.html', import.meta.url)

createServer(async (_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(await readFile(page))
}).listen(4173, '127.0.0.1', () => {
  console.log('marlow-web ready on http://127.0.0.1:4173')
})
`

const TABLE_BASE = `import type { Invoice } from '@marlow/sdk'
import { StatusTag } from './status-tag'

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <table className="w-full">
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>{invoice.number}</td>
            <td>{invoice.customer.name}</td>
            <td><StatusTag status={invoice.status} /></td>
            <td className="text-right tabular-nums">{invoice.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
`

const TABLE_CHANGED = TABLE_BASE.replace('className="w-full"', 'className="w-full table-fixed"').replace(
  '<td>{invoice.customer.name}</td>',
  '<td className="truncate">{invoice.customer.name}</td>',
)

const REPOS: Repo[] = [
  {
    name: 'marlow-api',
    branch: 'feat/idempotency-keys',
    commits: [
      {
        message: 'feat: invoices and customers routes',
        files: {
          'package.json': `${JSON.stringify({ name: 'marlow-api', version: '3.8.0', private: true, type: 'module', scripts: { dev: 'tsx watch src/server.ts', test: 'vitest run', migrate: 'drizzle-kit migrate' } }, null, 2)}\n`,
          'README.md': '# marlow-api\n\nBilling API for Marlow: customers, invoices and payouts.\n',
          'tsconfig.json': '{\n  "compilerOptions": { "strict": true, "module": "esnext", "target": "es2022" }\n}\n',
          '.gitignore': 'node_modules\ndist\n.env\n',
          'src/server.ts': "import { Hono } from 'hono'\nimport { customerRoutes } from './routes/customers'\nimport { invoiceRoutes } from './routes/invoices'\n\nexport const app = new Hono()\napp.route('/customers', customerRoutes)\napp.route('/invoices', invoiceRoutes)\n",
          'src/routes/invoices.ts': INVOICES_BASE,
          'src/routes/customers.ts': "import { Hono } from 'hono'\nimport { db } from '../db/client'\nimport { customers } from '../db/schema'\n\nexport const customerRoutes = new Hono()\n\ncustomerRoutes.get('/', async (c) => c.json(await db.select().from(customers)))\n",
          'src/routes/schemas.ts': "import { z } from 'zod'\n\nexport const invoiceInput = z.object({\n  customerId: z.string(),\n  amount: z.string(),\n  currency: z.enum(['EUR', 'USD', 'GBP']),\n  dueAt: z.string().date(),\n})\n",
          'src/db/client.ts': "import { drizzle } from 'drizzle-orm/node-postgres'\n\nexport const db = drizzle(process.env.DATABASE_URL ?? '')\n",
          'src/db/schema.ts': "import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'\n\nexport const customers = pgTable('customers', { id: text('id').primaryKey(), name: text('name').notNull() })\n\nexport const invoices = pgTable('invoices', {\n  id: text('id').primaryKey(),\n  customerId: text('customer_id').notNull(),\n  amount: integer('amount').notNull(),\n  currency: text('currency').notNull(),\n  dueAt: timestamp('due_at').notNull(),\n})\n\nexport const idempotencyKeys = pgTable('idempotency_keys', {\n  key: text('key').primaryKey(),\n  fingerprint: text('fingerprint').notNull(),\n  response: jsonb('response').notNull(),\n})\n",
          'src/lib/money.ts': "const EXPONENT = { EUR: 2, USD: 2, GBP: 2 } as const\n\nexport function toMinorUnits(amount: string, currency: keyof typeof EXPONENT): number {\n  return Math.round(Number(amount) * 10 ** EXPONENT[currency])\n}\n",
          'migrations/0013_payout_schedule.sql': 'alter table payouts add column schedule text not null default \'weekly\';\n',
          'test/invoices.test.ts': INVOICE_TEST_BASE,
        },
      },
      { message: 'fix: round half up when converting to minor units', files: { 'src/lib/money.ts': "const EXPONENT = { EUR: 2, USD: 2, GBP: 2 } as const\n\nexport function toMinorUnits(amount: string, currency: keyof typeof EXPONENT): number {\n  return Math.round(Number(amount) * 10 ** EXPONENT[currency] + Number.EPSILON)\n}\n" } },
    ],
    working: {
      'src/routes/invoices.ts': INVOICES_CHANGED,
      'src/lib/idempotency.ts': IDEMPOTENCY,
      'migrations/0014_idempotency_keys.sql': MIGRATION,
      'test/invoices.test.ts': INVOICE_TEST_CHANGED,
    },
  },
  {
    name: 'marlow-web',
    branch: 'fix/invoice-table-overflow',
    commits: [
      {
        message: 'feat: invoices page',
        files: {
          'package.json': `${JSON.stringify({ name: 'marlow-web', version: '1.22.0', private: true, type: 'module', scripts: { dev: 'node server.js', build: 'next build' } }, null, 2)}\n`,
          'README.md': '# marlow-web\n\nThe Marlow dashboard.\n',
          'server.js': WEB_SERVER,
          'public/invoices.html': WEB_PAGE,
          'src/app/invoices/page.tsx': "import { InvoiceTable } from './table'\nimport { listInvoices } from '@marlow/sdk'\n\nexport default async function Invoices() {\n  return <InvoiceTable invoices={await listInvoices()} />\n}\n",
          'src/app/invoices/table.tsx': TABLE_BASE,
          'src/app/invoices/status-tag.tsx': "export function StatusTag({ status }: { status: string }) {\n  return <span data-status={status}>{status}</span>\n}\n",
        },
      },
    ],
    working: { 'src/app/invoices/table.tsx': TABLE_CHANGED },
  },
  {
    name: 'marlow-sdk',
    branch: 'release/2.4',
    commits: [
      {
        message: 'feat: listInvoices pagination',
        files: {
          'package.json': `${JSON.stringify({ name: '@marlow/sdk', version: '2.4.0-rc.1', type: 'module' }, null, 2)}\n`,
          'CHANGELOG.md': '# Changelog\n\n## 2.3.0\n\n- Added `listCustomers`\n',
          'src/index.ts': "export { listInvoices } from './invoices'\nexport type { Invoice } from './types'\n",
          'src/invoices.ts': "import type { Invoice } from './types'\n\nexport async function listInvoices(cursor?: string): Promise<Invoice[]> {\n  const response = await fetch(`/invoices?cursor=${cursor ?? ''}`)\n  return response.json()\n}\n",
          'src/types.ts': 'export interface Invoice {\n  id: string\n  number: string\n  total: string\n  status: string\n  customer: { name: string }\n}\n',
        },
      },
    ],
    working: {
      'CHANGELOG.md': '# Changelog\n\n## 2.4.0\n\n### Added\n\n- `listInvoices` takes a cursor and returns pages of 50\n- `createInvoice` sends an `Idempotency-Key` when you pass `retryKey`\n- Typed errors for 409 and 422 responses\n\n### Fixed\n\n- Amounts above 2^31 minor units no longer overflow\n- `dueAt` is sent as a date, not a timestamp\n\n### Deprecated\n\n- `getInvoices`, use `listInvoices`\n\n## 2.3.0\n\n- Added `listCustomers`\n',
    },
  },
  {
    name: 'harbor-infra',
    branch: 'staging-postgres-16',
    commits: [
      {
        message: 'feat: staging database module',
        files: {
          'README.md': '# harbor-infra\n\nTerraform for the Marlow environments.\n',
          'main.tf': 'module "database" {\n  source         = "./modules/rds"\n  name           = var.environment\n  engine_version = "15.8"\n  instance_class = var.db_instance_class\n}\n',
          'variables.tf': 'variable "environment" {\n  type = string\n}\n\nvariable "db_instance_class" {\n  type    = string\n  default = "db.t4g.medium"\n}\n',
          'modules/rds/main.tf': 'resource "aws_db_instance" "this" {\n  identifier     = "${var.name}-postgres"\n  engine         = "postgres"\n  engine_version = var.engine_version\n  instance_class = var.instance_class\n}\n',
          'envs/staging.tfvars': 'environment       = "staging"\ndb_instance_class = "db.t4g.medium"\n',
          'envs/production.tfvars': 'environment       = "production"\ndb_instance_class = "db.r7g.large"\n',
        },
      },
    ],
    working: {
      'main.tf': 'module "database" {\n  source         = "./modules/rds"\n  name           = var.environment\n  engine_version = "16.4"\n  instance_class = var.db_instance_class\n}\n',
    },
  },
  {
    name: 'tidepool',
    branch: 'main',
    commits: [
      {
        message: 'feat: nightly events backfill',
        files: {
          'pyproject.toml': '[project]\nname = "tidepool"\nversion = "0.9.2"\nrequires-python = ">=3.12"\ndependencies = ["polars", "httpx"]\n',
          'README.md': '# tidepool\n\nNightly pipeline that loads billing events into the warehouse.\n',
          'tidepool/__init__.py': '',
          'tidepool/pipeline.py': 'from tidepool.sources import events\n\n\ndef run(day: str) -> int:\n    rows = events.load(day)\n    return len(dedupe(rows))\n\n\ndef dedupe(rows: list[dict]) -> list[dict]:\n    seen: dict[str, dict] = {}\n    for row in rows:\n        seen[row["id"]] = row\n    return list(seen.values())\n',
          'tidepool/sources/events.py': 'import httpx\n\n\ndef load(day: str) -> list[dict]:\n    return httpx.get(f"https://events.internal/{day}").json()\n',
          'tests/test_pipeline.py': 'from tidepool.pipeline import dedupe\n\n\ndef test_dedupe_keeps_latest():\n    rows = [{"id": "a", "v": 1}, {"id": "a", "v": 2}]\n    assert dedupe(rows) == [{"id": "a", "v": 2}]\n',
        },
      },
    ],
    working: {},
  },
  {
    name: 'handbook',
    branch: 'main',
    commits: [
      {
        message: 'docs: on-call runbook',
        files: {
          'README.md': '# Handbook\n\nHow the Marlow team works.\n',
          'docs/onboarding.md': '# Onboarding\n\n1. Get access to the staging environment\n2. Run `marlow-api` locally\n3. Ship a small fix in your first week\n',
          'docs/runbooks/on-call.md': '# On-call\n\n## Payout job is late\n\nCheck the queue depth first, then the last deploy.\n',
          'docs/runbooks/database-upgrade.md': '# Database upgrade\n\nUpgrade staging first and leave it for one full billing cycle.\n',
        },
      },
    ],
    working: {},
  },
]

const STANDIN = String.raw`#!/usr/bin/env bash
pine() { ELECTRON_RUN_AS_NODE=1 "$PINE_NODE" "$PINE_CLI" "$@"; }
quiet() { "$@" >/dev/null 2>&1; }
dim=$'\033[2m'; bold=$'\033[1m'; green=$'\033[32m'; red=$'\033[31m'; off=$'\033[0m'
beat() { sleep 0.05; }
say() { printf '  %s\n' "$1"; beat; }
gap() { printf '\n'; }
step() { printf '  %s%-6s%s %s\n' "$dim" "$1" "$off" "$2"; beat; }
out() { printf '         %s%s%s\n' "$dim" "$1" "$off"; beat; }
change() {
  local stat
  stat=$(git diff --numstat -- "$1" | awk '{print $1" "$2}')
  if [ -z "$stat" ]; then printf 'new file'; return; fi
  set -- $stat
  printf '%s+%s%s %s-%s%s' "$green" "$1" "$off" "$red" "$2" "$off"
}
hold() { exec cat >/dev/null; }

agent=$(basename "$0")
quiet pine resume-token "$agent" "$(basename "$PWD")-7c41e09a"
gap

case "$(basename "$PWD")" in
  marlow-api)
    quiet pine state working "Making POST /invoices idempotent"
    say "I'll make POST /invoices safe to retry."
    gap
    step Read "src/routes/invoices.ts"
    step Read "src/db/schema.ts"
    step Write "src/lib/idempotency.ts"
    step Write "migrations/0014_idempotency_keys.sql"
    step Edit "src/routes/invoices.ts  $(change src/routes/invoices.ts)"
    step Edit "test/invoices.test.ts  $(change test/invoices.test.ts)"
    step Run "pnpm test invoices"
    out "3 passed in 1.4s"
    step Run "pine git open src/routes/invoices.ts"
    quiet pine git open src/routes/invoices.ts
    step Run "pine process run \"pnpm dev\" --name api"
    quiet pine process run "pnpm dev" --name api
    gap
    say "A repeated request with the same Idempotency-Key now gets the"
    say "stored invoice back instead of creating a second one. The diff"
    say "is open beside this pane and the dev server is in the api tab."
    gap
    say "$bold""Migration 0014 adds a table. Apply it to the dev database?$off"
    quiet pine state waiting "Apply migration 0014 to the dev database?"
    ;;
  marlow-web)
    quiet pine state working "Checking the invoice table at 1280px"
    say "The customer column has no width limit, so long names push"
    say "the amount off the page."
    gap
    step Read "src/app/invoices/table.tsx"
    step Edit "src/app/invoices/table.tsx  $(change src/app/invoices/table.tsx)"
    step Run "pine process run \"node server.js\" --name web"
    quiet pine process run "node server.js" --name web
    sleep 1.5
    step Run "pine browse open http://127.0.0.1:4173/invoices"
    quiet pine browse open http://127.0.0.1:4173/invoices
    sleep 1.5
    step Run "pine browse snapshot -i"
    pine browse snapshot -i 2>/dev/null | head -4 | while IFS= read -r line; do out "$line"; done
    step Run "pine browse find role button click --name \"New invoice\""
    quiet pine browse find role button click --name "New invoice"
    step Run "pine browse get text \"#count\""
    out "$(pine browse get text '#count' 2>/dev/null)"
    gap
    say "The table keeps its columns at 1280px and a new draft row"
    say "shows up at the top. Ready for you to look at."
    quiet pine state done "Invoice table fits at 1280px"
    ;;
  marlow-sdk)
    quiet pine state working "Writing the 2.4.0 release notes"
    step Read "CHANGELOG.md"
    step Run "git log v2.3.0..HEAD --oneline"
    out "11 commits"
    step Edit "CHANGELOG.md  $(change CHANGELOG.md)"
    gap
    say "Notes for 2.4.0 are written: 3 additions, 2 fixes and"
    say "1 deprecation."
    quiet pine state done "Release notes for 2.4.0 are ready"
    ;;
  harbor-infra)
    quiet pine state working "Planning the Postgres 16 upgrade for staging"
    quiet pine workspace describe "Planning the Postgres 16 upgrade for staging"
    say "Staging runs Postgres 15.8. I'll plan the move to 16.4."
    gap
    step Read "modules/rds/main.tf"
    step Read "envs/staging.tfvars"
    step Edit "main.tf  $(change main.tf)"
    step Run "terraform plan -var-file=envs/staging.tfvars"
    out "Refreshing state: 41 resources"
    ;;
  *)
    quiet pine state working "Reading the project"
    step Read "README.md"
    ;;
esac
hold
`

const PNPM = String.raw`#!/usr/bin/env bash
case "$*" in
  test*)
    printf '\n \033[32m✓\033[0m test/invoices.test.ts (3 tests) 412ms\n\n'
    printf ' Test Files  1 passed (1)\n      Tests  3 passed (3)\n   Duration  1.38s\n\n'
    ;;
  dev*)
    printf '\n> marlow-api@3.8.0 dev\n> tsx watch src/server.ts\n\n'
    printf 'marlow-api listening on http://127.0.0.1:8787\n'
    printf '\033[2mGET  /health 200 1ms\033[0m\n'
    printf '\033[2mPOST /invoices 201 38ms\033[0m\n'
    printf '\033[2mPOST /invoices 200 4ms (replayed)\033[0m\n'
    exec sleep 100000
    ;;
esac
`

const UV = String.raw`#!/usr/bin/env bash
sleep 5
printf '.F                                                                       [100%%]\n'
printf '=================================== FAILURES ===================================\n'
printf '\033[31m__________________________ test_dedupe_across_days ___________________________\033[0m\n\n'
printf '    def test_dedupe_across_days():\n'
printf '        rows = load_fixture("2026-09-27") + load_fixture("2026-09-28")\n'
printf '>       assert len(dedupe(rows)) == 1840\n'
printf '\033[31mE       assert 1846 == 1840\033[0m\n\n'
printf 'tests/test_pipeline.py:19: AssertionError\n'
printf '\033[31m1 failed\033[0m, \033[32m1 passed\033[0m in 0.41s\n'
exit 1
`

export const PROJECTS = REPOS.map((repo) => repo.name)

export function seedHome(home: string): void {
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, '.zshrc'), "PROMPT='%~ ❯ '\nexport PATH=\"$HOME/.local/bin:$PATH\"\n")
  writeFileSync(join(home, '.bashrc'), "PS1='\\w ❯ '\nexport PATH=\"$HOME/.local/bin:$PATH\"\n")
  writeFileSync(
    join(home, '.gitconfig'),
    '[user]\n\tname = Dana Reyes\n\temail = dana@marlow.example\n[init]\n\tdefaultBranch = main\n[core]\n\tpager = cat\n',
  )
  mkdirSync(join(home, '.ssh'), { recursive: true })
  writeFileSync(join(home, '.ssh', 'id_ed25519'), 'placeholder for the demo, not a key\n')
  const bin = join(home, '.local', 'bin')
  mkdirSync(bin, { recursive: true })
  for (const [name, script] of Object.entries({ claude: STANDIN, codex: STANDIN, pnpm: PNPM, uv: UV })) {
    writeFileSync(join(bin, name), script)
    chmodSync(join(bin, name), 0o755)
  }
  for (const repo of REPOS) {
    const root = join(home, repo.name)
    mkdirSync(root, { recursive: true })
    const git = gitIn(home, root)
    git('init', '-b', 'main')
    for (const commit of repo.commits) {
      write(root, commit.files)
      git('add', '-A')
      git('commit', '-m', commit.message)
    }
    if (repo.branch !== 'main') git('checkout', '-b', repo.branch)
    write(root, repo.working)
  }
}
