import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Target, Crosshair, CircleDot } from 'lucide-react';
import type { KeyFrame } from '@/types/lbw';
import { cn } from '@/lib/utils';

interface KeyFrameThumbnailsProps {
  keyFrames?: KeyFrame[];
  className?: string;
}

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

export function KeyFrameThumbnails({ keyFrames, className }: KeyFrameThumbnailsProps) {
  const [selectedFrame, setSelectedFrame] = useState<KeyFrame | null>(null);

  if (!keyFrames || keyFrames.length === 0) {
    return (
      <Card className={cn("bg-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No key frames available for this analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("bg-card", className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Key Moments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {keyFrames.map((frame, index) => (
              <button
                key={`${frame.type}-${index}`}
                onClick={() => setSelectedFrame(frame)}
                className="group relative overflow-hidden rounded-lg border bg-muted/50 hover:bg-muted transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={frame.imageUrl}
                    alt={frame.label}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Frame type badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "absolute top-2 left-2 text-xs capitalize",
                      frameColors[frame.type]
                    )}
                  >
                    {frameIcons[frame.type]}
                    <span className="ml-1">{frame.type}</span>
                  </Badge>
                  
                  {/* Frame info */}
                  <div className="absolute bottom-2 left-2 right-2 text-left">
                    <p className="text-white text-sm font-medium truncate">
                      {frame.label}
                    </p>
                    <p className="text-white/70 text-xs">
                      Frame {frame.frameNumber}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enlarged view dialog */}
      <Dialog open={!!selectedFrame} onOpenChange={() => setSelectedFrame(null)}>
        <DialogContent className="max-w-3xl">
          {selectedFrame && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {frameIcons[selectedFrame.type]}
                  <span className="capitalize">{selectedFrame.label}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedFrame.imageUrl}
                    alt={selectedFrame.label}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={frameColors[selectedFrame.type]}>
                      {frameIcons[selectedFrame.type]}
                      <span className="ml-1 capitalize">{selectedFrame.type}</span>
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    Frame #{selectedFrame.frameNumber}
                  </div>
                  <div className="text-muted-foreground">
                    {selectedFrame.timestamp.toFixed(2)}s
                  </div>
                </div>
                <p className="text-muted-foreground">
                  {selectedFrame.description}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
