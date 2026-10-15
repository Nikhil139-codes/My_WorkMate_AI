import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export function getMongoUri(): string {
  return process.env.MONGODB_URI || "mongodb://localhost:27017";
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || "workmate_ai";
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached!.conn && mongoose.connection.readyState === 1) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const uri = getMongoUri();
    const dbName = getMongoDbName();

    const opts: mongoose.ConnectOptions = {
      dbName,
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    };

    cached!.promise = mongoose.connect(uri, opts).then((m) => {
      return m;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();
  try {
    const mongo = await connectToDatabase();
    if (mongo.connection.db) {
      await mongo.connection.db.command({ ping: 1 });
    }
    return {
      connected: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.message || "Unable to reach MongoDB database",
      latencyMs: Date.now() - startTime,
    };
  }
}
