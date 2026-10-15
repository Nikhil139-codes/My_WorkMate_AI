/**
 * Video Processor — extracts audio track and keyframes from video files.
 *
 * Pipeline:
 * 1. Use fluent-ffmpeg (with bundled binaries from @ffmpeg-installer/ffmpeg) to extract
 *    the audio track as a WAV file, then transcribe with Groq Whisper.
 * 2. Extract JPEG keyframes at configurable intervals using fluent-ffmpeg.
 * 3. Run OCR on each keyframe using tesseract.js to produce visual scene descriptions.
 * 4. Combine transcribed speech segments and visual frame descriptions into
 *    timestamped searchable chunks.
 *
 * Note: Groq currently has no vision model on this account, so visual understanding
 * is provided via OCR-derived text from video frames. The pipeline is designed to
 * accept a vision model call in future when one becomes available.
 */

import fs from "fs";
import path from "path";
import os from "os";
import {
  transcribeAudio,
  groupSegmentsIntoChunks,
  TranscriptSegment,
  GROQ_AUDIO_MAX_BYTES,
  formatTimestampRange,
} from "./audioProcessor";

export interface VideoFrameDescription {
  /** Frame timestamp in seconds */
  timestampSeconds: number;
  /** OCR-extracted text or visual scene description */
  description: string;
  /** Path to the extracted frame JPEG (temp, cleaned up after processing) */
  framePath?: string;
}

export interface VideoProcessingResult {
  transcriptText: string;
  transcriptLanguage: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
  frames: VideoFrameDescription[];
  model: string;
}

/** Supported video MIME types */
export const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "video/ogg",
]);

/** Supported video extensions */
export const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "mov", "avi", "mpeg", "mpg", "ogv",
]);

/** Max video file size (200 MB) */
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** Frame extraction interval in seconds (configurable via env) */
function getFrameIntervalSeconds(): number {
  return parseInt(process.env.VIDEO_FRAME_INTERVAL_SEC || "30", 10);
}

/**
 * Get the ffmpeg binary path directly from node_modules/@ffmpeg-installer/
 * Avoids calling require("@ffmpeg-installer/ffmpeg") which triggers Next.js Turbopack
 * bundle errors due to dynamic package.json resolution inside that package.
 */
function getFfmpegPath(): string {
  try {
    const platform = `${process.platform}-${process.arch}`;
    const binary = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

    // 1. Direct path in node_modules/@ffmpeg-installer/<platform>/
    const directPath = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", platform, binary);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    // 2. Nested path in node_modules/@ffmpeg-installer/ffmpeg/node_modules/
    const nestedPath = path.join(
      process.cwd(),
      "node_modules",
      "@ffmpeg-installer",
      "ffmpeg",
      "node_modules",
      "@ffmpeg-installer",
      platform,
      binary
    );
    if (fs.existsSync(nestedPath)) {
      return nestedPath;
    }

    // 3. Fallback to system ffmpeg command in PATH
    return "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

/**
 * Extract audio track from video as WAV using fluent-ffmpeg.
 * Returns the path to the temp WAV file.
 */
async function extractAudioFromVideo(
  videoPath: string,
  outputDir: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg");
  ffmpeg.setFfmpegPath(getFfmpegPath());

  const audioPath = path.join(outputDir, "audio.wav");

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000) // Whisper optimal sample rate
      .audioChannels(1)
      .format("wav")
      .output(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", (err: Error) =>
        reject(new Error(`Audio extraction failed: ${err.message}`))
      )
      .run();
  });
}

/**
 * Extract JPEG keyframes at regular intervals using fluent-ffmpeg.
 * Returns array of { timestampSeconds, framePath }.
 */
async function extractVideoFrames(
  videoPath: string,
  durationSeconds: number,
  outputDir: string
): Promise<Array<{ timestampSeconds: number; framePath: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg");
  ffmpeg.setFfmpegPath(getFfmpegPath());

  const intervalSec = getFrameIntervalSeconds();
  const framesDir = path.join(outputDir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });

  const timestamps: number[] = [];
  for (let t = 0; t < durationSeconds; t += intervalSec) {
    timestamps.push(t);
  }
  // Always include the last frame
  if (timestamps.length === 0 || timestamps[timestamps.length - 1] < durationSeconds - 1) {
    timestamps.push(Math.max(0, durationSeconds - 1));
  }

  const results: Array<{ timestampSeconds: number; framePath: string }> = [];

  for (const ts of timestamps) {
    const framePath = path.join(framesDir, `frame_${ts}s.jpg`);
    await new Promise<void>((resolve) => {
      ffmpeg(videoPath)
        .seekInput(ts)
        .frames(1)
        .output(framePath)
        .on("end", () => resolve())
        .on("error", () => resolve()) // Non-fatal — some timestamps may fail
        .run();
    });

    if (fs.existsSync(framePath)) {
      results.push({ timestampSeconds: ts, framePath });
    }
  }

  return results;
}

/**
 * Get video duration in seconds using ffprobe (bundled with ffmpeg).
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg");
  ffmpeg.setFfmpegPath(getFfmpegPath());

  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
      if (err || !metadata?.format?.duration) {
        resolve(0);
      } else {
        resolve(Math.ceil(Number(metadata.format.duration)));
      }
    });
  });
}

/**
 * Run OCR on a JPEG frame buffer.
 * Returns descriptive text with a "[Visual at MM:SS]" prefix.
 */
async function describeFrameWithOcr(
  framePath: string,
  timestampSeconds: number
): Promise<string> {
  try {
    const frameBuffer = fs.readFileSync(framePath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ocrImage } = require("./ocrProcessor");
    const ocrResult = await ocrImage(frameBuffer);
    const ocrText = ocrResult.text.trim();

    if (ocrText.length < 10) {
      return `[Visual frame at ${formatTimestampRange(timestampSeconds, timestampSeconds)}: No readable text detected in this frame]`;
    }

    return `[Visual frame at ${formatTimestampRange(timestampSeconds, timestampSeconds)}]: ${ocrText}`;
  } catch {
    return `[Visual frame at ${formatTimestampRange(timestampSeconds, timestampSeconds)}: Frame analysis unavailable]`;
  }
}

/**
 * Main video processing pipeline:
 * 1. Save buffer to temp file
 * 2. Extract audio → transcribe with Groq Whisper
 * 3. Extract keyframes → OCR each frame
 * 4. Return combined result
 */
export async function processVideo(
  videoBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<VideoProcessingResult> {
  if (videoBuffer.length > VIDEO_MAX_BYTES) {
    throw new Error(
      `Video file is ${(videoBuffer.length / 1024 / 1024).toFixed(0)} MB, ` +
        `exceeding the 200 MB processing limit.`
    );
  }

  const tmpDir = path.join(os.tmpdir(), `workmate-video-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const ext = path.extname(filename) || ".mp4";
  const videoPath = path.join(tmpDir, `input${ext}`);
  fs.writeFileSync(videoPath, videoBuffer);

  try {
    // 1. Get video duration
    const durationSeconds = await getVideoDuration(videoPath);

    // 2. Extract audio and transcribe
    let segments: TranscriptSegment[] = [];
    let transcriptText = "";
    let transcriptLanguage = "en";
    let transcriptionModel = "whisper-large-v3-turbo";

    try {
      const audioPath = await extractAudioFromVideo(videoPath, tmpDir);
      const audioBuffer = fs.readFileSync(audioPath);

      if (audioBuffer.length > 0 && audioBuffer.length <= GROQ_AUDIO_MAX_BYTES) {
        const transcriptResult = await transcribeAudio(
          audioBuffer,
          `${path.parse(filename).name}.wav`,
          "audio/wav"
        );
        transcriptText = transcriptResult.text;
        transcriptLanguage = transcriptResult.language;
        segments = transcriptResult.segments;
        transcriptionModel = transcriptResult.model;
      } else if (audioBuffer.length > GROQ_AUDIO_MAX_BYTES) {
        transcriptText = "[Audio track exceeds 25 MB Groq limit — transcription skipped]";
      }
    } catch (audioErr: any) {
      console.warn(`[VideoProcessor] Audio extraction/transcription failed: ${audioErr.message}`);
      transcriptText = "[Audio transcription failed — speech content unavailable]";
    }

    // 3. Extract keyframes and run OCR
    const frames: VideoFrameDescription[] = [];

    try {
      const rawFrames = await extractVideoFrames(videoPath, durationSeconds, tmpDir);

      for (const { timestampSeconds, framePath } of rawFrames) {
        const description = await describeFrameWithOcr(framePath, timestampSeconds);
        frames.push({ timestampSeconds, description, framePath });
      }
    } catch (frameErr: any) {
      console.warn(`[VideoProcessor] Frame extraction failed: ${frameErr.message}`);
    }

    return {
      transcriptText,
      transcriptLanguage,
      durationSeconds,
      segments,
      frames,
      model: transcriptionModel,
    };
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
