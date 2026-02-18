import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import type { PitchAnalysis } from '@/types/lbw';

interface PitchMapProps {
  analysis: PitchAnalysis;
  criteria: { pitchedInLine: boolean };
}

const zoneLabels = {
  outside_leg: { label: 'OUTSIDE LEG', color: 'bg-destructive', textColor: 'text-destructive' },
  inline: { label: 'IN LINE', color: 'bg-success', textColor: 'text-success' },
  outside_off: { label: 'OUTSIDE OFF', color: 'bg-success', textColor: 'text-success' },
};

export function PitchMap({ analysis, criteria }: PitchMapProps) {
  const zoneInfo = zoneLabels[analysis.zone];
  
  // Calculate ball position on pitch map
  // Center is 0, negative = off side, positive = leg side
  const ballPosition = analysis.zone === 'outside_leg' 
    ? 30 + Math.min(analysis.distanceFromLegStump, 40)
    : analysis.zone === 'outside_off'
    ? -30 - Math.min(Math.abs(analysis.distanceFromOffStump), 40)
    : (analysis.distanceFromLegStump + analysis.distanceFromOffStump) / 2;
  
  // Normalize to percentage (center = 50%)
  const ballX = 50 + (ballPosition / 80) * 40;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Pitch Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Zone Status */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg mb-4",
          criteria.pitchedInLine ? "bg-success/10" : "bg-destructive/10"
        )}>
          <span className="text-sm font-medium">Pitched</span>
          <span className={cn("font-bold", zoneInfo.textColor)}>
            {zoneInfo.label}
          </span>
        </div>

        {/* Visual Pitch Map */}
        <div className="relative bg-gradient-to-b from-amber-900/30 to-amber-800/20 rounded-lg p-4 h-48">
          {/* Pitch rectangle */}
          <div className="absolute inset-x-8 top-4 bottom-4 border-2 border-amber-600/40 rounded" />
          
          {/* Zone divisions */}
          <div className="absolute inset-x-8 top-4 bottom-4 flex">
            {/* Outside Leg Zone */}
            <div className="w-1/4 bg-destructive/20 border-r border-dashed border-amber-600/40 flex items-end justify-center pb-2">
              <span className="text-[10px] text-muted-foreground rotate-[-90deg] origin-center whitespace-nowrap">
                OUTSIDE LEG
              </span>
            </div>
            
            {/* In Line Zone - Stumps Area */}
            <div className="w-2/4 bg-success/10 flex flex-col items-center justify-between py-2">
              {/* Stumps representation */}
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-1 h-3 bg-amber-600/60 rounded-sm" />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">IN LINE</span>
            </div>
            
            {/* Outside Off Zone */}
            <div className="w-1/4 bg-success/5 border-l border-dashed border-amber-600/40 flex items-end justify-center pb-2">
              <span className="text-[10px] text-muted-foreground rotate-90 origin-center whitespace-nowrap">
                OUTSIDE OFF
              </span>
            </div>
          </div>
          
          {/* Ball pitch point */}
          <div 
            className="absolute w-5 h-5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 border-2 border-white animate-pulse"
            style={{ 
              left: `calc(${Math.max(12, Math.min(88, ballX))}% - 10px)`,
              top: '45%',
            }}
          />
          
          {/* Distance markers */}
          <div className="absolute bottom-2 left-8 right-8 flex justify-between text-[9px] text-muted-foreground">
            <span>LEG</span>
            <span>OFF</span>
          </div>
        </div>

        {/* Detailed Measurements */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">From Leg Stump</div>
            <span className={cn(
              "text-lg font-bold",
              analysis.distanceFromLegStump > 0 ? "text-destructive" : "text-success"
            )}>
              {Math.abs(analysis.distanceFromLegStump).toFixed(1)} cm
            </span>
            <div className="text-[10px] text-muted-foreground">
              {analysis.distanceFromLegStump > 0 ? 'outside' : 'inside'}
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Bounce Angle</div>
            <span className="text-lg font-bold text-primary">
              {analysis.bounceAngle.toFixed(1)}°
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}