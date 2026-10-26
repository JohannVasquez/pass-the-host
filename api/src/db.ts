import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from './generated/prisma/client'

export const getPrisma = (db: D1Database): PrismaClient => new PrismaClient({ adapter: new PrismaD1(db) })
