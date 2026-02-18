import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crosshair, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ImpactAnalysis } from '@/types/lbw';

interface ImpactZoneDisplayProps {
  analysis: ImpactAnalysis;
  criteria: { impactInLine: boolean };
}

const zoneLabels = {
  inline: { label: 'IN LINE', color: 'text-success', bgColor: 'bg-success/10' },
  outside_off: { label: 'OUTSIDE OFF', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  outside_leg: { label: 'OUTSIDE LEG', color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

export function ImpactZoneDisplay({ analysis, criteria }: ImpactZoneDisplayProps) {
  const zoneInfo = zoneLabels[analysis.zone];
  
  // Calculate impact position for visualization
  const impactX = analysis.zone === 'inline' 
    ? 50 
    : analysis.zone === 'outside_off' 
    ? 75 + Math.min(Math.abs(analysis.distanceFromOffStump) / 2, 20)
    : 25 - Math.min(analysis.distanceFromLegStump / 2, 20);
  
  const impactY = Math.max(10, Math.min(90, 100 - (analysis.height / analysis.stumpHeight) * 80));
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-primary" />
          Impact Zone
          {analysis.umpiresCall === 'UMPIRES_CALL' && (
            <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Umpire's Call
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Zone Status */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg mb-4",
          criteria.impactInLine ? "bg-success/10" : "bg-destructive/10"
        )}>
          <span className="text-sm font-medium">Impact</span>
          <span className={cn("font-bold", zoneInfo.color)}>
            {zoneInfo.label}
          </span>
        </div>

        {/* Visual Impact Display */}
        <div className="relative bg-muted/30 rounded-lg h-48 overflow-hidden">
          {/* Batsman silhouette (simplified leg area) */}
          <div className="absolute inset-0 flex items-end justify-center pb-4">
            <div className="relative w-24 h-32">
              {/* Pad area */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-24 bg-gray-600/30 rounded-t-full" />
              
              {/* Leg behind pad */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-28 bg-gray-700/20 rounded-t-lg" />
            </div>
          </div>
          
          {/* Zone overlay */}
          <div className="absolute inset-0 flex">
            <div className="w-1/3 border-r border-dashed border-muted-foreground/20 flex items-end justify-center pb-2">
              <span className="text-[9px] text-muted-foreground">LEG SIDE</span>
            </div>
            <div className="w-1/3 bg-success/5 flex items-end justify-center pb-2">
              <span className="text-[9px] text-muted-foreground">IN LINE</span>
            </div>
            <div className="w-1/3 border-l border-dashed border-muted-foreground/20 flex items-end justify-center pb-2">
              <span className="text-[9px] text-muted-foreground">OFF SIDE</span>
            </div>
          </div>
          
          {/* Stump height line */}
          <div 
            className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/50"
            style={{ top: '20%' }}
          >
            <span className="absolute right-2 -top-3 text-[9px] text-amber-500">STUMP HEIGHT</span>
          </div>
          
          {/* Impact point */}
          <div 
            className={cn(
              "absolute w-6 h-6 rounded-full border-2 border-white flex items-center justify-center",
              criteria.impactInLine ? "bg-success shadow-success/50" : "bg-destructive shadow-destructive/50"
            )}
            style={{ 
              left: `calc(${impactX}% - 12px)`,
              top: `calc(${impactY}% - 12px)`,
              boxShadow: `0 0 20px ${criteria.impactInLine ? '#22c55e' : '#ef4444'}`
            }}
          >
            <Crosshair className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Impact Details */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Height</div>
            <span className={cn(
              "text-sm font-bold",
              analysis.isAboveStumps ? "text-destructive" : "text-success"
            )}>
              {analysis.height.toFixed(1)} cm
            </span>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Stump Height</div>
            <span className="text-sm font-bold text-primary">
              {analysis.stumpHeight} cm
            </span>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-1">From Off</div>
            <span className="text-sm font-bold">
              {Math.abs(analysis.distanceFromOffStump).toFixed(1)} cm
            </span>
          </div>
        </div>

        {/* Above Stumps Warning */}
        {analysis.isAboveStumps && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-amber-500">Impact height above stump level</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}