"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InfoIcon } from "@/components/icons";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Level {
  id: string;
  name: string;
  difficulty?: string;
  userObjective?: string;
  readme_content?: string;
}

interface LevelSelectorProps {
  gameName: string;
  onLevelSelect: (level: Level) => void;
  selectedLevel?: Level;
  className?: string;
  levels?: Level[];
  isLoading?: boolean;
  error?: string | null;
}

export function LevelSelector({ 
  gameName,
  onLevelSelect, 
  selectedLevel, 
  className, 
  levels: providedLevels, 
  isLoading: providedIsLoading, 
  error: providedError 
}: LevelSelectorProps) {
  // Use provided props or fall back to local state for backward compatibility
  const [localLevels, setLocalLevels] = useState<Level[]>([]);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const levels = providedLevels || localLevels;
  const isLoading = providedIsLoading ?? localIsLoading;
  const error = providedError || localError;

  useEffect(() => {
    // Only fetch if no levels are provided via props
    if (providedLevels) return;

    const fetchLevels = async () => {
      setLocalIsLoading(true);
      setLocalError(null);
      
      try {
        const response = await fetch(`/api/levels?gameName=${gameName}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error response:', errorText);
          throw new Error(`Failed to fetch levels: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle different possible response formats
        let levelsData: Level[] = [];
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
        }));

        setLocalLevels(formattedLevels);
        
        // Auto-select first level if no level is currently selected
        if (formattedLevels.length > 0 && !selectedLevel) {
          onLevelSelect(formattedLevels[0]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch levels";
        setLocalError(errorMessage);
        console.error("Error fetching levels:", err);
      } finally {
        setLocalIsLoading(false);
      }
    };

    fetchLevels();
  }, [providedLevels, selectedLevel, onLevelSelect]);

  const handleLevelChange = (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      onLevelSelect(level);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedLevel?.id || ""}
        onValueChange={handleLevelChange}
        disabled={isLoading || levels.length === 0}
      >
        <SelectTrigger className={className}>
          <SelectValue 
            placeholder={
              isLoading 
                ? "Loading levels..." 
                : error 
                  ? "Error loading levels" 
                  : "Select a level"
            } 
          />
        </SelectTrigger>
        <SelectContent>
          {error ? (
            <SelectItem value="error" disabled>
              {error}
            </SelectItem>
          ) : levels.length === 0 && !isLoading ? (
            <SelectItem value="no-levels" disabled>
              No levels available
            </SelectItem>
          ) : (
            levels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                <div className="flex flex-col">
                  <span>{level.name}</span>
                  {level.difficulty && (
                    <span className="text-xs text-muted-foreground">
                      {level.difficulty}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {selectedLevel && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              type="button"
            >
              <InfoIcon size={16} />
              <span className="sr-only">Show level information</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[500px] md:w-[640px]">
            <SheetHeader>
              <SheetTitle>{selectedLevel.name}</SheetTitle>
              <SheetDescription>
                Level information
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 h-full">
              {selectedLevel.readme_content ? (
                <MarkdownRenderer className="overflow-y-auto h-[calc(100%-100px)] mb-2">
                  {selectedLevel.readme_content}
                </MarkdownRenderer>
              ) : (
                <p className="text-muted-foreground">
                  No additional help information is available for this level.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
