export type AppEnv = {
  Bindings: {
    DB: D1Database
    ABLY_API_KEY: string
    JWT_SECRET: string
    SIGNUP_LIMITER: RateLimit
    JOIN_LIMITER: RateLimit
    DISCORD_LIMITER: RateLimit
    DISCORD_CLIENT_ID: string
    DISCORD_CLIENT_SECRET: string
    DISCORD_BOT_TOKEN: string
    DISCORD_GATEWAY: DurableObjectNamespace
    ROOM_HUB: DurableObjectNamespace<import('./roomHub').RoomHub>
    /** 'ably' (default) or 'do': which realtime backend the app uses */
    REALTIME?: string
  }
  Variables: { jwtPayload: { sub: string } }
}
