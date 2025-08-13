import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.NAME_DB;

if (!uri) throw new Error("MONGODB_URI não definido");
if (!dbName) throw new Error("NAME_DB não definido");

let client;
let db;

export async function getDb() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  db = client.db(dbName);
  return db;
}
