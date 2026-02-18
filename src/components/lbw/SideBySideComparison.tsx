import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Rewind,
  Columns,
  Video,
  Image,
  Camera,
  Target,
  Crosshair,
  CircleDot,
  Volume2,
  VolumeX
} from 'lucide-react';
import type { KeyFrame } from '@/types/lbw';
import { cn } from '@/lib/utils';

interface SideBySideComparisonProps {
  keyFrames?: KeyFrame[];
  videoUrl?: string;
  className?: string;
}

const speedOptions = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
];

const frameIcons: Record<KeyFrame['type'], React.ReactNode> = {
  release: <Camera className="h-3 w-3" />,
  bounce: <CircleDot className="h-3 w-3" />,
  impact: <Target className="h-3 w-3" />,
  wicket: <Crosshair className="h-3 w-3" />,
};

const frameColors: Record<KeyFrame['type'], string> = {
  release: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  bounce: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  impact: 'bg-red-500/10 text-red-600 border-red-500/20',
  wicket: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function SideBySideComparison({ keyFrames, videoUrl, className }: SideBySideComparisonProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentFrame = keyFrames?.[currentIndex];

  // Calculate interval based on speed
  const getInterval = useCallback(() => {
    return 1500 / speed;
  }, [speed]);

  // Sync video to current key frame timestamp
  const syncVideoToFrame = useCallback((frame: KeyFrame | undefined) => {
    if (syncEnabled && videoRef.current && frame) {
      videoRef.current.currentTime = frame.timestamp;
    }
  }, [syncEnabled]);

  // Handle play/pause for frame sequence
  useEffect(() => {
    if (isPlaying && keyFrames && keyFrames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = prev >= keyFrames.length - 1 ? 0 : prev + 1;
          if (prev >= keyFrames.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return nextIndex;
        });
      }, getInterval());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, keyFrames, getInterval]);

  // Sync video when frame changes
  useEffect(() => {
    syncVideoToFrame(currentFrame);
  }, [currentFrame, syncVideoToFrame]);

  // Control video playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Sync video play/pause with frame playback
  useEffect(() => {
    if (videoRef.current && syncEnabled) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, syncEnabled]);

  const handlePlayPause = () => {
    if (currentIndex >= (keyFrames?.length ?? 1) - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    setIsPlaying(false);
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
  };

  const handleNext = () => {
    setIsPlaying(false);
    const newIndex = Math.min((keyFrames?.length ?? 1) - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    if (videoRef.current) {
      videoRef.current.currentTime = keyFrames?.[0]?.timestamp || 0;
    }
    setIsPlaying(true);
  };

  const handleSliderChange = (value: number[]) => {
    setIsPlaying(false);
    setCurrentIndex(value[0]);
  };

  const handleFrameClick = (index: number) => {
    setIsPlaying(false);
    setCurrentIndex(index);
  };

  if (!keyFrames || keyFrames.length === 0) {
    return (
      <Card className={cn("bg-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Side-by-Side Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No key frames available for comparison
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Side-by-Side Comparison
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="sync-toggle"
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
              />
              <Label htmlFor="sync-toggle" className="text-sm text-muted-foreground">
                Sync Playback
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Side-by-side display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Video Panel */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Video className="h-4 w-4" />
              Original Video
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    muted={isMuted}
                    playsInline
                    onError={(e) => {
                      console.error('Video load error:', e);
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-2 right-2 h-8 w-8 bg-black/60 hover:bg-black/80"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Badge 
                    variant="secondary" 
                    className="absolute top-2 left-2 bg-black/60 text-white border-none text-xs"
                  >
                    {speed}x Speed
                  </Badge>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Video className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-sm">No video available</span>
                  <span className="text-xs">Upload a video to see comparison</span>
                </div>
              )}
            </div>
          </div>

          {/* Key Frame Panel */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Image className="h-4 w-4" />
              Key Frame Analysis
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              {currentFrame && (
                <>
                  <img
                    src={currentFrame.imageUrl}
                    alt={currentFrame.label}
                    className="w-full h-full object-contain transition-opacity duration-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                  
                  {/* Frame type badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "absolute top-2 left-2 text-xs capitalize",
                      frameColors[currentFrame.type]
                    )}
                  >
                    {frameIcons[currentFrame.type]}
                    <span className="ml-1">{currentFrame.type}</span>
                  </Badge>

                  {/* Frame counter */}
                  <Badge 
                    variant="secondary" 
                    className="absolute top-2 right-2 bg-black/60 text-white border-none text-xs"
                  >
                    {currentIndex + 1} / {keyFrames.length}
                  </Badge>

                  {/* Bottom info */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-sm font-medium truncate">
                      {currentFrame.label}
                    </p>
                    <p className="text-white/70 text-xs">
                      {currentFrame.timestamp.toFixed(2)}s • Frame #{currentFrame.frameNumber}
                    </p>
                  </div>
                </>
              )}

              {/* Playing indicator */}
              {isPlaying && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline and key frame markers */}
        <div className="space-y-2">
          <Slider
            value={[currentIndex]}
            min={0}
            max={keyFrames.length - 1}
            step={1}
            onValueChange={handleSliderChange}
            className="cursor-pointer"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {keyFrames.map((frame, index) => (
              <button
                key={`marker-${frame.type}-${index}`}
                onClick={() => handleFrameClick(index)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs transition-all",
                  index === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                {frameIcons[frame.type]}
                <span className="capitalize">{frame.type}</span>
                <span className="text-[10px] opacity-70">{frame.timestamp.toFixed(1)}s</span>
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

          {/* Speed buttons */}
          <div className="flex items-center gap-1 ml-2 border-l pl-3">
            {speedOptions.map((option) => (
              <Button
                key={option.value}
                variant={speed === option.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSpeed(option.value)}
                className="text-xs h-8 px-2"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Current frame description */}
        {currentFrame && (
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{currentFrame.label}:</span>{' '}
              {currentFrame.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
