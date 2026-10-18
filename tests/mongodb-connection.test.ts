import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getMongoUri, getMongoDbName } from "../src/lib/db/mongodb";

describe("MongoDB Configuration & Connection Tests", () => {
  const originalMongoUri = process.env.MONGODB_URI;
  const originalMongoDb = process.env.MONGODB_DB;

  afterEach(() => {
    // Restore environment variables
    if (originalMongoUri !== undefined) {
      process.env.MONGODB_URI = originalMongoUri;
    } else {
      delete process.env.MONGODB_URI;
    }

    if (originalMongoDb !== undefined) {
      process.env.MONGODB_DB = originalMongoDb;
    } else {
      delete process.env.MONGODB_DB;
    }
  });

  it("should return the configured MONGODB_URI when defined", () => {
    const testUri = "mongodb+srv://testuser:secretpass@cluster0.example.mongodb.net/?retryWrites=true";
    process.env.MONGODB_URI = testUri;

    const uri = getMongoUri();
    assert.equal(uri, testUri);
  });

  it("should throw a clear error when MONGODB_URI is undefined rather than falling back to localhost", () => {
    delete process.env.MONGODB_URI;

    assert.throws(
      () => {
        getMongoUri();
      },
      {
        name: "Error",
        message: /MONGODB_URI environment variable is not defined/i,
      }
    );
  });

  it("should throw a clear error when MONGODB_URI is an empty string", () => {
    process.env.MONGODB_URI = "";

    assert.throws(
      () => {
        getMongoUri();
      },
      {
        name: "Error",
        message: /MONGODB_URI environment variable is not defined/i,
      }
    );
  });

  it("should return configured MONGODB_DB or default to workmate_ai", () => {
    process.env.MONGODB_DB = "custom_db";
    assert.equal(getMongoDbName(), "custom_db");

    delete process.env.MONGODB_DB;
    assert.equal(getMongoDbName(), "workmate_ai");
  });
});
