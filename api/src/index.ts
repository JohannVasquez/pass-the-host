import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { jwt } from 'hono/jwt'
import { device } from './device'
import type { AppEnv } from './env'
import { groups } from './groups'
import { profile } from './profile'
import { realtime } from './realtime'

const authed = new Hono<AppEnv>()
authed.use((c, next) => jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next))
authed.route('/groups', groups)
authed.route('/me', profile)
authed.route('/', realtime)

const app = new Hono<AppEnv>().basePath('/api')
app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', device)
app.route('/', authed)
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  return c.json({ error: 'internal_error' }, 500)
})

export default app
