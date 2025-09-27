"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Game {
  name: string;
  description: string;
  endpoint: string;
}

interface GameSelectorProps {
  onGameSelect: (level: Game) => void;
  selectedGame?: Game;
  className?: string;
  games?: Game[];
  isLoading?: boolean;
  error?: string | null;
}

export function GameSelector({ 
  onGameSelect, 
  selectedGame, 
  className, 
  games: providedGames, 
  isLoading: providedIsLoading, 
  error: providedError 
}: GameSelectorProps) {
  // Use provided props or fall back to local state for backward compatibility
  const [localGames, setLocalGames] = useState<Game[]>([]);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const games = providedGames || localGames;
  const isLoading = providedIsLoading ?? localIsLoading;
  const error = providedError || localError;

  useEffect(() => {
    // Only fetch if no levels are provided via props
    if (providedGames) return;

    const fetchGames = async () => {
      setLocalIsLoading(true);
      setLocalError(null);
      
      try {
        const response = await fetch('/api/games');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle different possible response formats
        let gamesData: Game[] = [];
        if (Array.isArray(data)) {
          gamesData = data;
        } else if (data.games && Array.isArray(data.games)) {
          gamesData = data.games;
        } else if (data.data && Array.isArray(data.data)) {
          gamesData = data.data;
        } else {
          throw new Error("Invalid response format: expected array of games");
        }

        setLocalGames(gamesData);
        
        // Auto-select first game if no game is currently selected
        if (gamesData.length > 0 && !selectedGame) {
          onGameSelect(gamesData[0]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch games";
        setLocalError(errorMessage);
        console.error("Error fetching games:", err);
      } finally {
        setLocalIsLoading(false);
      }
    };

    fetchGames();
  }, [providedGames, selectedGame, onGameSelect]);

  const handleGameChange = (gameName: string) => {
    const game = games.find(g => g.name === gameName);
    if (game) {
      onGameSelect(game);
    }
  };

  return (
    <Select
      value={selectedGame?.name || ""}
      onValueChange={handleGameChange}
      disabled={isLoading || games.length === 0}
    >
      <SelectTrigger className={className}>
        <SelectValue 
          placeholder={
            isLoading 
              ? "Loading games..." 
              : error 
                ? "Error loading games" 
                : "Select a game"
          } 
        />
      </SelectTrigger>
      <SelectContent>
        {error ? (
          <SelectItem value="error" disabled>
            {error}
          </SelectItem>
        ) : games.length === 0 && !isLoading ? (
          <SelectItem value="no-levels" disabled>
            No levels available
          </SelectItem>
        ) : (
          games.map((game) => (
            <SelectItem key={game.name} value={game.name}>
              <div className="flex flex-col">
                <span>{game.description}</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
