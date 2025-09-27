import { ManualChatMessage } from "@/app/(chat)/api/chat/schema";
import { type ChatMessage } from "@/lib/types";

export interface ManualProviderOptions {
  history: ManualChatMessage[];
  message: string;
  game: string;
  levelId: string | number;
}

export interface ManualProviderResponse {
  passed: boolean;
  pass_rationale: string;
  error: boolean;
  messages: {
    content: string;
    role: "user" | "assistant" | "system";
  }[];
}

/**
 * Manual provider that calls the game API with messages and returns a complete response
 * This provider does not use streaming and returns the full response at once
 */
export async function createManualProvider(options: ManualProviderOptions): Promise<ManualProviderResponse> {
  const { history, message, game, levelId } = options;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
    }

    const endpoint = `${apiUrl}/api/v1/games/${game}/${levelId}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history: history.map((m) => ({
          content: m.content,
          type: m.role === "user" ? "human" : "ai",
        })),
        message
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const {messages:dataMessages, ...rest} = data;
    const messages = dataMessages.map((m: any) => ({
      content: m.content,
      role: m.type === "human" ? "user" : "assistant",
    }));
    return {messages, ...rest};
  } catch (error) {
    console.error("Manual provider request failed:", error);
    return {
      error: true,
      passed: false,
      pass_rationale: "",
      messages: [],
    };
  }
}

/**
 * Convenience function to call the manual provider with just messages
 */
// export async function callManualProvider(
//   history: ManualChatMessage[],
//   message: string,
//   game: string,
//   levelId: string,
// ): Promise<string> {
//   const result = await createManualProvider({ history, message, game, levelId });

//   if (!result.success) {
//     throw new Error(result.error || 'Manual provider failed');
//   }

//   return result.text || '';
// }

// /**
//  * Batch process multiple message sets
//  */
// export async function batchManualProvider(
//   requests: Array<{ messages: ChatMessage[]; levelId?: string }>
// ): Promise<Array<{ success: boolean; text?: string; error?: string }>> {
//   const promises = requests.map(req => createManualProvider(req));
//   return Promise.all(promises);
// }
