import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalSemanticEmbedding,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
} from "../src/lib/ai/embeddings";

describe("Embeddings & Vector Math Tests", () => {
  it("should generate deterministic unit-normalized embeddings of standard dimension", () => {
    const text = "Enterprise contract renewal terms for Fiscal Year 2026";
    const vector1 = generateLocalSemanticEmbedding(text);
    const vector2 = generateLocalSemanticEmbedding(text);

    assert.equal(vector1.length, EMBEDDING_DIMENSION);
    assert.deepEqual(vector1, vector2);

    // Verify unit length L2 norm approximately 1.0
    let sumSq = 0;
    for (const val of vector1) {
      sumSq += val * val;
    }
    const norm = Math.sqrt(sumSq);
    assert.ok(Math.abs(norm - 1.0) < 0.001);
  });

  it("should compute accurate cosine similarity between identical and distinct vectors", () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [-1, 0, 0];

    assert.equal(Math.round(cosineSimilarity(vecA, vecB)), 1);
    assert.equal(cosineSimilarity(vecA, vecC), 0);
    assert.equal(Math.round(cosineSimilarity(vecA, vecD)), -1);
  });

  it("should score semantically similar text higher than unrelated text", () => {
    const baseText = "Financial earnings report and corporate quarterly revenue growth";
    const similarText = "Quarterly financial report detailing business revenue and earnings";
    const unrelatedText = "Banana smoothie recipe with crushed almonds and strawberries";

    const baseVec = generateLocalSemanticEmbedding(baseText);
    const similarVec = generateLocalSemanticEmbedding(similarText);
    const unrelatedVec = generateLocalSemanticEmbedding(unrelatedText);

    const scoreSimilar = cosineSimilarity(baseVec, similarVec);
    const scoreUnrelated = cosineSimilarity(baseVec, unrelatedVec);

    assert.ok(
      scoreSimilar > scoreUnrelated,
      `Expected similar score (${scoreSimilar}) to be higher than unrelated score (${scoreUnrelated})`
    );
  });
});
