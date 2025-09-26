"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { LevelSelector } from "./level-selector";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  // Shared levels data and state
  const [levels, setLevels] = useState<{ id: string; name: string; difficulty?: string }[]>([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string; difficulty?: string } | undefined>();
  const [objective, setObjective] = useState<string>("");

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // Fetch levels data once on component mount
  useEffect(() => {
    const fetchLevels = async () => {
      setIsLoadingLevels(true);
      setLevelsError(null);
      
      try {
        const response = await fetch('/api/levels');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`Failed to fetch levels: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle different possible response formats
        let levelsData = [];
        if (Array.isArray(data)) {
          levelsData = data;
        } else if (data.levels && Array.isArray(data.levels)) {
          levelsData = data.levels;
        } else if (data.data && Array.isArray(data.data)) {
          levelsData = data.data;
        } else {
          throw new Error("Invalid response format: expected array of levels");
        }

        // Ensure each level has required properties
        const formattedLevels = levelsData.map((level: any, index: number) => ({
          id: level.id || level._id || `level-${index}`,
          name: level.name || level.title || `Level ${index + 1}`,
          difficulty: level.difficulty || level.level || undefined,
          objective: level.objective || level.description || undefined,
        }));

        setLevels(formattedLevels);
        
        // Auto-select first level if available
        if (formattedLevels.length > 0 && !selectedLevel) {
          setSelectedLevel(formattedLevels[0]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch levels";
        setLevelsError(errorMessage);
        console.error("Error fetching levels:", err);
      } finally {
        setIsLoadingLevels(false);
      }
    };

    fetchLevels();
  }, []);

  // Update objective when selectedLevel changes
  useEffect(() => {
    if (!selectedLevel) {
      setObjective("");
      return;
    }

    const currentLevel = levels.find(level => level.id === selectedLevel.id);
    if (currentLevel && (currentLevel as any).objective) {
      setObjective((currentLevel as any).objective);
    } else {
      setObjective("No objective available for this level");
    }
  }, [selectedLevel, levels]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />
        <div className="flex w-full flex-col px-4 py-2 gap-8 justify-center items-center">
          <div className="w-full flex justify-center">
            <LevelSelector
              onLevelSelect={setSelectedLevel}
              selectedLevel={selectedLevel}
              className="w-full max-w-xs"
              levels={levels}
              isLoading={isLoadingLevels}
              error={levelsError}
            />
          </div>
          <div className="text-center text-sm bg-neutral-900 text-white rounded-full px-4 py-2">
           {selectedLevel?.name}
          </div>
        <div className="flex flex-col min-w-0 max-w-4xl px-4 py-2 gap-4 text-center items-center">
          <div className="w-full text-base font-bold flex justify-center">
            Objective
          </div>
          <div className="w-full flex justify-center">
            {isLoadingLevels ? (
              <div className="text-sm text-muted-foreground">Loading objective...</div>
            ) : levelsError ? (
              <div className="text-sm text-red-500">{levelsError}</div>
            ) : objective ? (
              <div className="text-sm text-center max-w-2xl px-4">
                {objective}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a level to see the objective</div>
            )}
          </div>
        </div>
        </div>
        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
