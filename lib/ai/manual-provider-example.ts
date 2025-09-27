// import { type ChatMessage } from "@/lib/types";
// import { createManualProvider, callManualProvider, batchManualProvider } from "./manual-provider";

// /**
//  * Example usage of the manual provider
//  * This file demonstrates how to use the manual provider in different scenarios
//  */

// // Example 1: Basic usage with createManualProvider
// export async function exampleBasicUsage() {
//   const messages: ChatMessage[] = [
//     {
//       id: "1",
//       role: "user" as const,
//       parts: [{ type: "text" as const, text: "Hello, how are you?" }],
//       metadata: { createdAt: new Date().toISOString() }
//     },
//     {
//       id: "2",
//       role: "assistant" as const,
//       parts: [{ type: "text" as const, text: "I'm doing well, thank you for asking!" }],
//       metadata: { createdAt: new Date().toISOString() }
//     },
//     {
//       id: "3",
//       role: "user" as const,
//       parts: [{ type: "text" as const, text: "Can you help me with a coding problem?" }],
//       metadata: { createdAt: new Date().toISOString() }
//     }
//   ];

//   const result = await createManualProvider({
//     messages,
//     levelId: "level-1", // Optional: specify a level ID
//     temperature: 0.7,
//     maxTokens: 1000
//   });

//   if (result.success) {
//     console.log("Response:", result.text);
//     console.log("Usage:", result.usage);
//   } else {
//     console.error("Error:", result.error);
//   }
// }

// // Example 2: Simple usage with callManualProvider
// export async function exampleSimpleUsage() {
//   const messages: ChatMessage[] = [
//     {
//       id: "1",
//       role: "user" as const,
//       parts: [{ type: "text" as const, text: "Explain quantum computing in simple terms" }],
//       metadata: { createdAt: new Date().toISOString() }
//     }
//   ];

//   try {
//     const response = await callManualProvider(messages, "level-2");
//     console.log("Simple response:", response);
//   } catch (error) {
//     console.error("Error:", error);
//   }
// }

// // Example 3: Batch processing multiple requests
// export async function exampleBatchUsage() {
//   const requests = [
//     {
//       messages: [{
//         id: "1",
//         role: "user" as const,
//         parts: [{ type: "text" as const, text: "What is React?" }],
//         metadata: { createdAt: new Date().toISOString() }
//       }],
//       levelId: "level-1"
//     },
//     {
//       messages: [{
//         id: "2",
//         role: "user" as const,
//         parts: [{ type: "text" as const, text: "What is Next.js?" }],
//         metadata: { createdAt: new Date().toISOString() }
//       }],
//       levelId: "level-1"
//     },
//     {
//       messages: [{
//         id: "3",
//         role: "user" as const,
//         parts: [{ type: "text" as const, text: "What is TypeScript?" }],
//         metadata: { createdAt: new Date().toISOString() }
//       }],
//       levelId: "level-2"
//     }
//   ];

//   const results = await batchManualProvider(requests);

//   results.forEach((result, index) => {
//     if (result.success) {
//       console.log(`Request ${index + 1} response:`, result.text);
//     } else {
//       console.error(`Request ${index + 1} error:`, result.error);
//     }
//   });
// }

// // Example 4: Building conversation history
// export async function exampleConversationHistory() {
//   const conversation: ChatMessage[] = [
//     {
//       id: "1",
//       role: "system" as const,
//       parts: [{ type: "text" as const, text: "You are a helpful coding assistant." }],
//       metadata: { createdAt: new Date().toISOString() }
//     },
//     {
//       id: "2",
//       role: "user" as const,
//       parts: [{ type: "text" as const, text: "Help me debug this error" }],
//       metadata: { createdAt: new Date().toISOString() }
//     },
//     {
//       id: "3",
//       role: "assistant" as const,
//       parts: [{ type: "text" as const, text: "Sure, what's the error message?" }],
//       metadata: { createdAt: new Date().toISOString() }
//     },
//     {
//       id: "4",
//       role: "user" as const,
//       parts: [{ type: "text" as const, text: "TypeError: Cannot read property 'map' of undefined" }],
//       metadata: { createdAt: new Date().toISOString() }
//     }
//   ];

//   const response = await callManualProvider(conversation);
//   console.log("Debug response:", response);
// }
