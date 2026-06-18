import Redis from 'ioredis';

let client: Redis | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL || process.env.REDIS_URI;
  if (!url) return null;
  client = new Redis(url);
  client.on('error', (err) => console.error('Redis error', err));
  return client;
}

export async function getCache(key: string): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const v = await c.get(key);
    return v;
  } catch (e) {
    console.error('redis get error', e);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await c.set(key, value, 'EX', Math.ceil(ttlSeconds));
    } else {
      await c.set(key, value);
    }
  } catch (e) {
    console.error('redis set error', e);
  }
}

export async function delCache(key: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.del(key);
  } catch (e) {
    console.error('redis del error', e);
  }
}

export function isRedisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_URI);
}
