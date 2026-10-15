import { DocumentChunk, IDocumentChunk } from "@/lib/db/models";

export const EMBEDDING_DIMENSION = 384;

/**
 * Calculates cosine similarity between two unit-normalized or arbitrary vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Fast deterministic dense semantic vector embedder.
 * Generates 384-dimensional normalized vector using multi-hash n-gram and subword projections.
 * Fully self-contained with no external API key requirement, ensuring zero downtime.
 */
export function generateLocalSemanticEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  if (words.length === 0) {
    // Return unit vector along first dimension if empty
    vector[0] = 1.0;
    return vector;
  }

  // FNV-1a inspired hash to populate dimensions with term and bi-gram weights
  const hashString = (str: string, seed: number) => {
    let hash = 2166136261 ^ seed;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = 1.0 / Math.sqrt(i + 1);

    // Unigram projection across multiple seeds
    for (let seed = 0; seed < 4; seed++) {
      const idx = hashString(word, seed * 37) % EMBEDDING_DIMENSION;
      const sign = (hashString(word, seed * 97) % 2 === 0 ? 1 : -1);
      vector[idx] += sign * weight;
    }

    // Bigram projection
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      for (let seed = 0; seed < 2; seed++) {
        const idx = hashString(bigram, seed * 53) % EMBEDDING_DIMENSION;
        const sign = (hashString(bigram, seed * 101) % 2 === 0 ? 1 : -1);
        vector[idx] += sign * (weight * 1.5);
      }
    }
  }

  // L2 Normalize vector to unit length
  let sumSquares = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    sumSquares += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSquares);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

/**
 * Generate embedding for text via configured provider (OpenAI or Local Semantic Embedder)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || "local";

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
          input: text.substring(0, 8000),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const vec = data?.data?.[0]?.embedding;
        if (Array.isArray(vec) && vec.length > 0) {
          return vec;
        }
      }
    } catch (err) {
      console.warn("OpenAI embedding API failed, falling back to local embedder:", err);
    }
  }

  // Default / reliable fallback
  return generateLocalSemanticEmbedding(text);
}

/**
 * Batch generate embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t)));
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber: number;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorSearchOptions {
  workspaceId: string;
  query: string;
  documentIds?: string[];
  limit?: number;
  minScore?: number;
}

/**
 * Hybrid retrieval engine:
 * 1. Attempts MongoDB Atlas $vectorSearch aggregation if configured
 * 2. Falls back to workspace-scoped semantic cosine similarity + keyword relevance matching
 */
export async function retrieveRelevantChunks(
  options: VectorSearchOptions
): Promise<RetrievedChunk[]> {
  const { workspaceId, query, documentIds, limit = 5, minScore = 0.15 } = options;
  if (!query || !query.trim()) return [];

  const queryEmbedding = await generateEmbedding(query);
  const vectorIndexName = process.env.MONGODB_VECTOR_INDEX || "vector_index";

  // 1. Try MongoDB Atlas Vector Search
  try {
    const filter: Record<string, any> = {
      workspaceId: { $eq: workspaceId },
    };
    if (documentIds && documentIds.length > 0) {
      filter.documentId = { $in: documentIds };
    }

    const atlasResults = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: vectorIndexName,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: Math.max(limit * 10, 50),
          limit: limit,
          filter,
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          chunkIndex: 1,
          content: 1,
          pageNumber: 1,
          modality: 1,
          timestampStart: 1,
          timestampEnd: 1,
          formattedTimestamp: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    if (atlasResults && atlasResults.length > 0) {
      return atlasResults.map((r: any) => ({
        chunkId: r._id.toString(),
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        content: r.content,
        pageNumber: r.pageNumber || 1,
        score: r.score || 1.0,
        metadata: {
          ...(r.metadata || {}),
          modality: r.modality,
          timestampStart: r.timestampStart,
          timestampEnd: r.timestampEnd,
          formattedTimestamp: r.formattedTimestamp,
        },
      }));
    }
  } catch {
    // Atlas $vectorSearch not supported on local instances or vector index not created yet.
    // Gracefully proceed to the compatible fallback engine.
  }

  // 2. Compatible Fallback Engine: Workspace-scoped cosine + keyword scoring
  const queryFilter: Record<string, any> = { workspaceId };
  if (documentIds && documentIds.length > 0) {
    queryFilter.documentId = { $in: documentIds };
  }

  // Fetch candidate chunks for the workspace
  const chunks = await DocumentChunk.find(queryFilter)
    .select("_id documentId chunkIndex content pageNumber embedding metadata modality timestampStart timestampEnd formattedTimestamp")
    .limit(500)
    .lean();


  if (!chunks || chunks.length === 0) {
    return [];
  }

  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Boost introductory chunks if the user query is asking for an overview or summary
  const isOverviewQuery =
    query.toLowerCase().includes("summar") ||
    query.toLowerCase().includes("about") ||
    query.toLowerCase().includes("overview") ||
    query.toLowerCase().includes("what is") ||
    query.toLowerCase().includes("tell me") ||
    query.toLowerCase().includes("explain");

  const scoredChunks: RetrievedChunk[] = [];

  for (const chunk of chunks as unknown as IDocumentChunk[]) {
    let semanticScore = 0;
    if (chunk.embedding && chunk.embedding.length > 0) {
      semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    }

    // Keyword overlap boost
    const contentLower = chunk.content.toLowerCase();
    let keywordHits = 0;
    for (const token of queryTokens) {
      if (contentLower.includes(token)) {
        keywordHits++;
      }
    }
    const keywordScore = queryTokens.length > 0 ? keywordHits / queryTokens.length : 0;

    // Position boost for introductory sections if overview query
    const positionBoost = isOverviewQuery && chunk.chunkIndex < 2 ? 0.2 : 0;

    // Combined hybrid score
    const finalScore = semanticScore * 0.7 + keywordScore * 0.3 + positionBoost;

    // Always keep all candidate chunks with their scores
    scoredChunks.push({
      chunkId: (chunk as any)._id.toString(),
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      pageNumber: chunk.pageNumber || 1,
      score: finalScore,
      metadata: {
        ...(chunk.metadata || {}),
        modality: (chunk as any).modality,
        timestampStart: (chunk as any).timestampStart,
        timestampEnd: (chunk as any).timestampEnd,
        formattedTimestamp: (chunk as any).formattedTimestamp,
      },
    });
  }

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // If filtered chunks with minScore exist, return top-k
  const filtered = scoredChunks.filter((c) => c.score >= (options.minScore ?? 0.05));
  if (filtered.length > 0) {
    return filtered.slice(0, limit);
  }

  // Fallback: If query was targeted to specific documentIds or scoredChunks exists, return top-k candidates
  return scoredChunks.slice(0, limit);
}
