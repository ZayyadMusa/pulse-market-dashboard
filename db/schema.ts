import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export * from './auth-schema';

export const watchlist = sqliteTable('watchlist', {
  userId: text('user_id').notNull(),
  coinId: text('coin_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.coinId] })]);

export const apiCache = sqliteTable('api_cache', {
  key: text('key').primaryKey(),
  payload: text('payload'),
  fetchedAt: integer('fetched_at').notNull().default(0),
  expiresAt: integer('expires_at').notNull().default(0),
  leaseUntil: integer('lease_until').notNull().default(0),
});

export const apiUsage = sqliteTable('api_usage', {
  key: text('key').primaryKey(),
  calls: integer('calls').notNull().default(0),
});

export const cacheMetrics = sqliteTable('cache_metrics', {
  key: text('key').primaryKey(),
  value: integer('value').notNull().default(0),
});
