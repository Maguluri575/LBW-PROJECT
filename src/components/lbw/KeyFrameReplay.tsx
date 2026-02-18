import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Rewind, 
  FastForward,
  Film,
  Camera,
  Target,
  Crosshair,
  CircleDot
} from 'lucide-react';
import type { KeyFrame } from '@/types/lbw';
import { cn } from '@/lib/utils';

interface KeyFrameReplayProps {
  keyFrames?: KeyFrame[];
  className?: string;
}

const speedOptions = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
];

const frameIcons: Record<KeyFrame['type'], React.ReactNode> = {
  release: <Camera className="h-4 w-4" />,
  bounce: <CircleDot className="h-4 w-4" />,
  impact: <Target className="h-4 w-4" />,
  wicket: <Crosshair className="h-4 w-4" />,
};

const frameColors: Record<KeyFrame['type'], string> = {
  release: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  bounce: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  impact: 'bg-red-500/10 text-red-600 border-red-500/20',
  wicket: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function KeyFrameReplay({ keyFrames, className }: KeyFrameReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentFrame = keyFrames?.[currentIndex];

  // Calculate interval based on speed (base interval 1500ms for slow-mo effect)
  const getInterval = useCallback(() => {
    return 1500 / speed;
  }, [speed]);

  // Handle play/pause
  useEffect(() => {
    if (isPlaying && keyFrames && keyFrames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= keyFrames.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, getInterval());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, keyFrames, getInterval]);

  const handlePlayPause = () => {
    if (currentIndex >= (keyFrames?.length ?? 1) - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min((keyFrames?.length ?? 1) - 1, prev + 1));
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const handleSliderChange = (value: number[]) => {
    setIsPlaying(false);
    setCurrentIndex(value[0]);
  };

  if (!keyFrames || keyFrames.length === 0) {
    return (
      <Card className={cn("bg-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Film className="h-5 w-5" />
            Slow Motion Replay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No key frames available for replay
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Film className="h-5 w-5" />
          Slow Motion Replay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main display area */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
          {currentFrame && (
            <>
              <img
                src={currentFrame.imageUrl}
                alt={currentFrame.label}
                className="w-full h-full object-contain transition-opacity duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              
              {/* Frame overlay info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
              
              {/* Top bar - frame type */}
              <Badge
                variant="outline"
                className={cn(
                  "absolute top-3 left-3 text-sm capitalize",
                  frameColors[currentFrame.type]
                )}
              >
                {frameIcons[currentFrame.type]}
                <span className="ml-1.5">{currentFrame.type}</span>
              </Badge>

              {/* Speed indicator */}
              <Badge 
                variant="secondary" 
                className="absolute top-3 right-3 bg-black/60 text-white border-none"
              >
                {speed}x Speed
              </Badge>

              {/* Bottom bar - frame info */}
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white font-semibold text-lg">
                  {currentFrame.label}
                </h3>
                <p className="text-white/70 text-sm line-clamp-2">
                  {currentFrame.description}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                  <span>Frame #{currentFrame.frameNumber}</span>
                  <span>•</span>
                  <span>{currentFrame.timestamp.toFixed(2)}s</span>
                </div>
              </div>
            </>
          )}

          {/* Playing indicator */}
          {isPlaying && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
            </div>
          )}
        </div>

        {/* Timeline slider */}
        <div className="space-y-2">
          <Slider
            value={[currentIndex]}
            min={0}
            max={keyFrames.length - 1}
            step={1}
            onValueChange={handleSliderChange}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {keyFrames.map((frame, index) => (
              <button
                key={`marker-${frame.type}-${index}`}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(index);
                }}
                className={cn(
                  "capitalize transition-colors hover:text-foreground",
                  index === currentIndex && "text-primary font-medium"
                )}
              >
                {frame.type}
              </button>
            ))}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRestart}
            title="Restart"
          >
            <Rewind className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            title="Previous frame"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12"
            onClick={handlePlayPause}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === keyFrames.length - 1}
            title="Next frame"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSpeed((s) => speedOptions[(speedOptions.findIndex(o => o.value === s) + 1) % speedOptions.length].value)}
            title="Change speed"
          >
            <FastForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center justify-center gap-2">
          {speedOptions.map((option) => (
            <Button
              key={option.value}
              variant={speed === option.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setSpeed(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Frame thumbnails strip */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {keyFrames.map((frame, index) => (
            <button
              key={`thumb-${frame.type}-${index}`}
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(index);
              }}
              className={cn(
                "flex-shrink-0 relative w-20 aspect-video rounded overflow-hidden border-2 transition-all",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-muted-foreground/30"
              )}
            >
              <img
                src={frame.imageUrl}
                alt={frame.label}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              <div className={cn(
                "absolute inset-0 flex items-center justify-center text-white text-[10px] font-medium",
                index === currentIndex ? "bg-primary/40" : "bg-black/40"
              )}>
                {frame.type}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
