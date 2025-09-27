import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY,
});

// Custom language model that posts to your game API
function createGamePasswordModel(levelId?: string): LanguageModel {
  return {
    specificationVersion: "v2",
    provider: "custom-game",
    modelId: "game-password-model",
    defaultObjectGenerationMode: "tool",
    supportedUrls: [],
    supportsImageUrls: false,
    supportsStructuredOutputs: false,
    
    async doGenerate(options: any) {
      if (!levelId) {
        throw new Error("Level ID is required for game password model");
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
        }

        const response = await fetch(`/api/levels/${levelId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Next.js AI Provider',
          },
          body: JSON.stringify({
            messages: options.messages,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout for AI requests
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        return {
          rawCall: { rawPrompt: options.prompt, rawSettings: {} },
          finishReason: "stop",
          usage: {
            inputTokens: data.usage?.promptTokens || 0,
            outputTokens: data.usage?.completionTokens || 0,
            totalTokens: (data.usage?.promptTokens || 0) + (data.usage?.completionTokens || 0),
          },
          content: [{ type: "text", text: data.text || data.response || "No response from game API" }],
          warnings: [],
        };
      } catch (error) {
        console.error("Game API request failed:", error);
        throw error;
      }
    },

    async doStream(options: any) {
      if (!levelId) {
        throw new Error("Level ID is required for game password model");
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
        }

        const response = await fetch(`/api/levels/${levelId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Next.js AI Provider',
          },
          body: JSON.stringify({
            messages: options.messages,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            stream: true,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout for AI requests
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const stream = new ReadableStream({
          async start(controller) {
            try {
              if (!response.body) {
                throw new Error("No response body");
              }

              const reader = response.body.getReader();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (line.trim() === "") continue;
                  
                  try {
                    const data = JSON.parse(line);
                    if (data.text) {
                      controller.enqueue({
                        type: "text-delta",
                        id: "game-api-response",
                        delta: data.text,
                      });
                    }
                  } catch (e) {
                    // If not JSON, treat as plain text
                    controller.enqueue({
                      type: "text-delta",
                      id: "game-api-response",
                      delta: line,
                    });
                  }
                }
              }

              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return { 
          stream,
          rawCall: { rawPrompt: options.prompt, rawSettings: {} },
        };
      } catch (error) {
        console.error("Game API streaming failed:", error);
        throw error;
      }
    },
  } as unknown as LanguageModel;
}

export function createMyProvider(levelId?: string) {
  return isTestEnvironment
    ? (() => {
        const {
          artifactModel,
          chatModel,
          reasoningModel,
          titleModel,
        } = require("./models.mock");
        return customProvider({
          languageModels: {
            "chat-model": chatModel,
            "chat-model-reasoning": reasoningModel,
            "title-model": titleModel,
            "artifact-model": artifactModel,
          },
        });
      })()
    : customProvider({
      languageModels: {
        "chat-model": createGamePasswordModel(levelId) as any,
        "chat-model-reasoning": wrapLanguageModel({
          model: createGamePasswordModel(levelId) as any,
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": openai("gpt-4o-mini"), // Keep OpenAI for title generation
        "artifact-model": openai("gpt-4o"), // Keep OpenAI for artifacts
      },
      });
}

// Backward compatibility - default provider without level ID
export const myProvider = createMyProvider();
