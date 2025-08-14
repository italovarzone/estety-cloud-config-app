export const runtime = "nodejs";

import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.NAME_DB;

if (!uri) throw new Error("ENV MONGODB_URI ausente");
if (!dbName) throw new Error("ENV NAME_DB ausente");

let _client = globalThis.__mongoClient || null;
let _promise = globalThis.__mongoPromise || null;

function reset() {
  _client = null;
  _promise = null;
  globalThis.__mongoClient = null;
  globalThis.__mongoPromise = null;
}

async function connectFresh() {
  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    maxPoolSize: 10,
  });
  await client.connect();
  return client;
}

export async function getDb() {
  if (!_promise) {
    _client = null;
    _promise = (async () => {
      const c = await connectFresh();
      _client = c;
      return c;
    })();
    globalThis.__mongoPromise = _promise;
    globalThis.__mongoClient = _client;
  }

  try {
    const client = await _promise;
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    return db;
  } catch (err) {
    if (String(err).includes("Topology is closed") || String(err).includes("MongoNotConnectedError")) {
      try {
        reset();
        const fresh = await connectFresh();
        _client = fresh;
        _promise = Promise.resolve(fresh);
        globalThis.__mongoClient = _client;
        globalThis.__mongoPromise = _promise;
        const db = fresh.db(dbName);
        await db.command({ ping: 1 });
        return db;
      } catch (inner) {
        reset();
        throw inner;
      }
    }
    reset();
    throw err;
  }
}
