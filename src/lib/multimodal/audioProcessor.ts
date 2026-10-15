/**
 * Audio Processor — transcribes audio files using Groq Whisper API.
 *
 * Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm (Groq limits)
 * File-size limit: 25 MB per Groq's Audio API.
 * Model: configurable via GROQ_TRANSCRIPTION_MODEL (default: whisper-large-v3-turbo)
 *
 * Uses verbose_json response format to obtain per-segment timestamps.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { getGroqClient } from "@/lib/ai/groq";
import { toFile } from "groq-sdk";

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface AudioTranscriptResult {
  text: string;
  language: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
  model: string;
}

/** Max file size Groq accepts for audio (25 MB) */
export const GROQ_AUDIO_MAX_BYTES = 25 * 1024 * 1024;

/** Mime types Groq Whisper accepts */
export const GROQ_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-wav",
  "audio/wave",
  "video/mp4",   // Groq accepts mp4 for audio track
  "video/webm",
]);

/** File extensions Groq Whisper accepts */
export const GROQ_AUDIO_EXTENSIONS = new Set([
  "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm",
]);

/**
 * Format seconds to "MM:SS" string.
 */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Format a timestamp range "MM:SS – MM:SS".
 */
export function formatTimestampRange(start: number, end: number): string {
  return `${formatTimestamp(start)} – ${formatTimestamp(end)}`;
}

/**
 * Transcribe an audio buffer using Groq Whisper.
 * Returns structured segments with start/end timestamps.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<AudioTranscriptResult> {
  const model =
    process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo";

  if (audioBuffer.length > GROQ_AUDIO_MAX_BYTES) {
    throw new Error(
      `Audio file is ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB, ` +
        `exceeding Groq's 25 MB limit. Please split the file or reduce its size.`
    );
  }

  const client = getGroqClient();

  // Write buffer to temp file so we can pass it via toFile()
  const tmpDir = os.tmpdir();
  const tmpFilename = `workmate-audio-${Date.now()}${path.extname(filename)}`;
  const tmpPath = path.join(tmpDir, tmpFilename);

  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const fileStream = fs.createReadStream(tmpPath);
    const groqFile = await toFile(fileStream, filename, { type: mimeType });

    const response = await client.audio.transcriptions.create({
      file: groqFile,
      model,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      language: "en",
    });

    // verbose_json returns { text, language, duration, segments: [...] }
    const raw = response as any;

    const text: string = raw.text || "";
    const language: string = raw.language || "en";
    const durationSeconds: number = raw.duration || 0;

    const segments: TranscriptSegment[] = (raw.segments || []).map(
      (seg: any, idx: number) => ({
        id: idx,
        start: Number(seg.start ?? 0),
        end: Number(seg.end ?? 0),
        text: (seg.text || "").trim(),
      })
    );

    // If Groq didn't return segments (some turbo model versions), create one whole segment
    if (segments.length === 0 && text.trim()) {
      segments.push({ id: 0, start: 0, end: durationSeconds, text: text.trim() });
    }

    return { text, language, durationSeconds, segments, model };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
  }
}

/**
 * Group transcript segments into ~30-second "chunk windows" for RAG indexing.
 */
export function groupSegmentsIntoChunks(
  segments: TranscriptSegment[],
  windowSeconds = 30
): Array<{ start: number; end: number; text: string }> {
  const chunks: Array<{ start: number; end: number; text: string }> = [];
  let windowStart: number | null = null;
  let windowEnd = 0;
  let buffer: string[] = [];

  for (const seg of segments) {
    if (windowStart === null) {
      windowStart = seg.start;
    }

    buffer.push(seg.text.trim());
    windowEnd = seg.end;

    if (seg.end - windowStart! >= windowSeconds) {
      chunks.push({
        start: windowStart!,
        end: windowEnd,
        text: buffer.join(" ").trim(),
      });
      windowStart = null;
      buffer = [];
    }
  }

  // Flush remaining
  if (buffer.length > 0 && windowStart !== null) {
    chunks.push({
      start: windowStart,
      end: windowEnd,
      text: buffer.join(" ").trim(),
    });
  }

  return chunks;
}
