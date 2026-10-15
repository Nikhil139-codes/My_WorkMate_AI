import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid work email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must not exceed 100 characters"),
  workspaceName: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must not exceed 100 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(8000, "Message must not exceed 8000 characters"),
  model: z.string().optional(),
  mode: z.enum(["rag", "general"]).optional().default("general"),
  documentIds: z.array(z.string()).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
