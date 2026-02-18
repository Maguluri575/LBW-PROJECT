import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, RotateCw, TrendingUp, Zap } from 'lucide-react';
import type { BallMetrics } from '@/types/lbw';

interface BallSpeedometerProps {
  metrics: BallMetrics;
}

const ballTypeLabels: Record<string, { label: string; color: string }> = {
  inswing: { label: 'IN-SWING', color: 'text-blue-400' },
  outswing: { label: 'OUT-SWING', color: 'text-purple-400' },
  seam: { label: 'SEAM', color: 'text-green-400' },
  offspin: { label: 'OFF-SPIN', color: 'text-orange-400' },
  legspin: { label: 'LEG-SPIN', color: 'text-pink-400' },
  straight: { label: 'STRAIGHT', color: 'text-gray-400' },
};

export function BallSpeedometer({ metrics }: BallSpeedometerProps) {
  const ballTypeInfo = ballTypeLabels[metrics.ballType] || ballTypeLabels.straight;
  
  // Calculate percentage for the gauge (max 160 km/h)
  const speedPercentage = Math.min((metrics.speed / 160) * 100, 100);
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Ball Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Speed Display */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Delivery Speed</span>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full bg-muted", ballTypeInfo.color)}>
              {ballTypeInfo.label}
            </span>
          </div>
          
          {/* Speed Gauge */}
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${speedPercentage}%`,
                background: `linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)`
              }}
            />
          </div>
          
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>0</span>
            <span>80 km/h</span>
            <span>160 km/h</span>
          </div>
          
          <div className="mt-3 text-center">
            <span className="text-4xl font-bold text-primary">{metrics.speed.toFixed(1)}</span>
            <span className="text-xl text-muted-foreground ml-1">km/h</span>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3 w-3" />
              Release Speed
            </div>
            <span className="text-lg font-semibold">{metrics.releaseSpeed.toFixed(1)} km/h</span>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Impact Speed
            </div>
            <span className="text-lg font-semibold">{metrics.impactSpeed.toFixed(1)} km/h</span>
          </div>
          
          {metrics.spinRate && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <RotateCw className="h-3 w-3" />
                Spin Rate
              </div>
              <span className="text-lg font-semibold">{Math.round(metrics.spinRate)} RPM</span>
            </div>
          )}
          
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Deviation
            </div>
            <span className="text-lg font-semibold">{metrics.swingDeviation.toFixed(1)} cm</span>
          </div>
        </div>

        {/* Angle of Entry */}
        <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Angle of Entry</span>
            <span className="text-lg font-bold">{metrics.angleOfEntry.toFixed(1)}°</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}