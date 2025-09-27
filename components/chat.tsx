"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { GameSelector } from "./game-selector";
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
  const [levelsData, setLevelsData] = useState<{ id: string; name: string; difficulty?: string }[]>([]);
  const [gamesData, setGamesData] = useState<{ name: string; description: string; endpoint: string }[]>([]);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [gamesError, setGamesError] = useState<string | null>(null);

  // Memoize the levels array to prevent unnecessary re-renders
  const levels = useMemo(() => levelsData, [levelsData]);
  const games = useMemo(() => gamesData, [gamesData]);
  const [selectedGame, setSelectedGame] = useState<{ name: string; description: string; endpoint: string } | undefined>(undefined);
  const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string; difficulty?: string; userObjective?: string } | undefined>();
  
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // Fetch levels data once on component mount
  useEffect(() => {
    const fetchGames = async () => {
      setIsLoadingGames(true);
      setGamesError(null);
      
      try {
        const response = await fetch('/api/games');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API response data:', data);

        // Handle different possible response formats
        let gamesData = data.games;
        setGamesData(gamesData);
       
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch levels";
        setGamesError(errorMessage);
        console.error("Error fetching levels:", err);
      } finally {
        setIsLoadingGames(false);
      }
    };

    fetchGames();
  }, []);

  // Fetch levels data once on component mount
  useEffect(() => {
    const fetchLevels = async () => {
      setIsLoadingLevels(true);
      setLevelsError(null);
      
      try {
        const response = await fetch(`/api/levels?gameName=${selectedGame?.name}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`Failed to fetch levels: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API response data:', data);

        // Handle different possible response formats
        let levelsData = data.levels;

        // Ensure each level has required properties
        const formattedLevels = levelsData.map((level: any, index: number) => ({
          id: level.id || level._id || `level-${index}`,
          name: level.name || level.title || `Level ${index + 1}`,
          difficulty: level.difficulty || level.level || undefined,
          userObjective: level.userObjective || level.description || undefined,
        }));

        setLevelsData(formattedLevels);
        console.log('Formatted levels:', formattedLevels);
        // Auto-select first level if available
        if (formattedLevels.length > 0 && !selectedLevel) {
          const firstLevel = formattedLevels[0];
          console.log('Auto-selecting level:', firstLevel.name, 'with userObjective:', firstLevel.userObjective);
          setSelectedLevel(firstLevel);
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
  }, [selectedGame]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendMessage = async(message?: any) => {
    const messageText = message.parts[0].text;
    const chatMessage:ChatMessage = {
      id: generateUUID(),
      role: message.role,
      parts: [{ type: "text", text: messageText }],
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };
    setMessages([...messages, chatMessage]);

    const history = messages.map((message) => ({
      id: message.id,
      content: (message as any).parts[0].text || '',
      role: message.role,
    }));
    const response = await fetch('/api/chat/', {
      method: 'POST',
      body: JSON.stringify({
        id,
        history,
        message: messageText,
        levelId: selectedLevel?.id,
        game: selectedGame?.name,
      }),
    });
    const newMessageIndex = history.length + 1
    const data:any = await response.json();

    const {messages:serverMessages}:{messages: any[]} = data;
    const appendMessages:ChatMessage[] = [];
    for (let i = newMessageIndex; i < serverMessages.length; i++) {
      const message = serverMessages[i];
      const appendChatMessage:ChatMessage = {
        id: generateUUID(),
        role: message.role,
        parts: [{ type: "text", text: message.content }],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };
      appendMessages.push(appendChatMessage);
    }
    setMessages(prev => [...prev, ...appendMessages]);

    // passed?

    if (data.passed) {
      const nextLevelIndex = parseInt(selectedLevel?.id || '0')
      const nextLevel = levels?.[nextLevelIndex];
      // open modal with data.pass_rationale
      
      setTimeout(()=>{
        if (nextLevel) {
          setSelectedLevel(nextLevel);
          setMessages([]);
        }
      },5000)
      toast({
        type: "success",
        description: data.pass_rationale,
      });
    }
    
  };

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Handler for level selection that includes userObjective
  const handleLevelSelect = useCallback((level: { id: string; name: string; difficulty?: string }) => {
    setSelectedLevel(level);
  }, []);


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
            <GameSelector
              games={games}
              onGameSelect={(game)=>{setSelectedGame(game); setSelectedLevel(undefined)}}
              selectedGame={selectedGame}
              className="w-full max-w-xs"
              isLoading={isLoadingGames}
              error={gamesError}
            />
          </div>
          <div className="w-full flex justify-center">
            {selectedGame && 
              <LevelSelector
                gameName={selectedGame.name}
                onLevelSelect={handleLevelSelect}
                selectedLevel={selectedLevel}
                className="w-full max-w-xs"
                levels={levels}
                isLoading={isLoadingLevels}
                error={levelsError}
              />
            }
          </div>
          <div className="text-center text-sm bg-neutral-900 text-white rounded-full px-4 py-2" data-testid="selected-level-name">
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
            ) : selectedLevel?.userObjective ? (
              <div className="text-sm text-center max-w-2xl px-4">
                <div>{selectedLevel.userObjective}</div>
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
          regenerate={async() => {}}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          votes={[]}
          status="ready"
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
              status="ready"
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
        regenerate={async() => {}}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status="ready"
        stop= {async() => {}}
        votes={[]}
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
