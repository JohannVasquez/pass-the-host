export type AppEnv = {
  Bindings: {
    DB: D1Database
    ABLY_API_KEY: string
    JWT_SECRET: string
    SIGNUP_LIMITER: RateLimit
    JOIN_LIMITER: RateLimit
  }
  Variables: { jwtPayload: { sub: string } }
}
