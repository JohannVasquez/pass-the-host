import { defineConfig } from 'prisma/config'

// The CLI only needs a datasource to render SQL; the Worker talks to D1 through the adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'migrations' },
  datasource: { url: 'file:./dev.db' }
})
