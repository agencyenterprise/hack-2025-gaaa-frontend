import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  selectedVisibilityType: z.enum(["public", "private"]),
  selectedLevel: z.object({
    id: z.string(),
    name: z.string(),
    difficulty: z.string().optional(),
  }).optional(),
});


export const manualChatMessageSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  role: z.enum(["user", "assistant"]),
});
export const postManualRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.string(),
  history: z.array(manualChatMessageSchema),
  levelId: z.string().or(z.number()),
  game: z.string(),
});
export type ManualChatMessage = z.infer<typeof manualChatMessageSchema>;
export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type PostManualRequestBody = z.infer<typeof postManualRequestBodySchema>;
