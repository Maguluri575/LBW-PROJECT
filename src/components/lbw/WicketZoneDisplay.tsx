import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, AlertTriangle, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WicketPrediction } from '@/types/lbw';

interface WicketZoneDisplayProps {
  prediction: WicketPrediction;
  decision: 'OUT' | 'NOT_OUT';
}

const stumpLabels = {
  leg: { label: 'LEG STUMP', position: 25 },
  middle: { label: 'MIDDLE STUMP', position: 50 },
  off: { label: 'OFF STUMP', position: 75 },
  missing_leg: { label: 'MISSING LEG', position: 10 },
  missing_off: { label: 'MISSING OFF', position: 90 },
  over: { label: 'GOING OVER', position: 50 },
};

export function WicketZoneDisplay({ prediction, decision }: WicketZoneDisplayProps) {
  const stumpInfo = stumpLabels[prediction.stumpHit];
  const isHitting = prediction.wouldHit;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Wicket Prediction
          {prediction.umpiresCall === 'UMPIRES_CALL' && (
            <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Umpire's Call
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Hit Percentage Display */}
        <div className={cn(
          "relative rounded-xl p-6 mb-4 overflow-hidden",
          isHitting ? "bg-destructive/10" : "bg-success/10"
        )}>
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isHitting ? (
                <X className="h-6 w-6 text-destructive" />
              ) : (
                <Check className="h-6 w-6 text-success" />
              )}
              <span className={cn(
                "text-2xl font-bold",
                isHitting ? "text-destructive" : "text-success"
              )}>
                {isHitting ? 'HITTING WICKETS' : 'MISSING WICKETS'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {stumpInfo.label}
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Wicket Zone Visualization */}
        <div className="relative bg-gradient-to-b from-muted/50 to-muted/20 rounded-lg h-40 overflow-hidden">
          {/* Stumps */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2">
            {['LEG', 'MIDDLE', 'OFF'].map((stump, i) => (
              <div key={stump} className="flex flex-col items-center">
                <div 
                  className={cn(
                    "w-2 h-20 rounded-t",
                    isHitting && stumpInfo.position === (25 + i * 25) 
                      ? "bg-destructive animate-pulse" 
                      : "bg-amber-600"
                  )}
                />
                <span className="text-[8px] text-muted-foreground mt-1">{stump}</span>
              </div>
            ))}
          </div>
          
          {/* Bails */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1">
            <div className="w-6 h-1 bg-amber-600 rounded" />
            <div className="w-6 h-1 bg-amber-600 rounded" />
          </div>
          
          {/* Ball trajectory indicator */}
          <div 
            className={cn(
              "absolute w-4 h-4 rounded-full",
              isHitting ? "bg-destructive" : "bg-success"
            )}
            style={{ 
              left: `calc(${stumpInfo.position}% - 8px)`,
              top: prediction.stumpHit === 'over' ? '15%' : '30%',
              boxShadow: `0 0 15px ${isHitting ? '#ef4444' : '#22c55e'}`
            }}
          />
          
          {/* Trajectory line (dashed) */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="trajGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isHitting ? '#ef4444' : '#22c55e'} stopOpacity="0.2" />
                <stop offset="100%" stopColor={isHitting ? '#ef4444' : '#22c55e'} stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <line 
              x1={`${stumpInfo.position}%`}
              y1="10%"
              x2={`${stumpInfo.position}%`}
              y2={prediction.stumpHit === 'over' ? '30%' : '75%'}
              stroke="url(#trajGradient)"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>

          {/* Zone labels */}
          <div className="absolute top-2 left-2 right-2 flex justify-between text-[9px] text-muted-foreground">
            <span>MISSING LEG</span>
            <span>HIT ZONE</span>
            <span>MISSING OFF</span>
          </div>
        </div>

        {/* Hit Percentage Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Ball Hitting Stumps</span>
            <span className={cn(
              "text-xl font-bold",
              prediction.hitPercentage >= 50 ? "text-destructive" : 
              prediction.hitPercentage >= 25 ? "text-amber-500" : "text-success"
            )}>
              {prediction.hitPercentage.toFixed(0)}%
            </span>
          </div>
          
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            {/* Umpire's call zones */}
            <div className="absolute inset-0 flex">
              <div className="w-1/4 bg-success/30" />
              <div className="w-1/4 bg-amber-500/30 border-x border-dashed border-muted-foreground/30" />
              <div className="w-2/4 bg-destructive/30" />
            </div>
            
            {/* Current percentage */}
            <div 
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-1000",
                prediction.hitPercentage >= 50 ? "bg-destructive" : 
                prediction.hitPercentage >= 25 ? "bg-amber-500" : "bg-success"
              )}
              style={{ width: `${prediction.hitPercentage}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
            <span>NOT OUT</span>
            <span className="text-amber-500">UMPIRE'S CALL (25-50%)</span>
            <span>OUT</span>
          </div>
        </div>

        {/* Margin of Error */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prediction Margin</span>
          <span className="text-lg font-bold">±{prediction.marginOfError.toFixed(1)} cm</span>
        </div>
      </CardContent>
    </Card>
  );
}