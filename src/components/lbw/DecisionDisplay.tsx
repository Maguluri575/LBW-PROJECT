import { cn } from '@/lib/utils';
import { Check, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Decision, LBWCriteria } from '@/types/lbw';

interface DecisionDisplayProps {
  decision: Decision;
  confidence: number;
  criteria: LBWCriteria;
}

export function DecisionDisplay({ decision, confidence, criteria }: DecisionDisplayProps) {
  const isOut = decision === 'OUT';
  
  const criteriaItems = [
    { 
      key: 'pitchedInLine', 
      label: 'Ball pitched in line', 
      value: criteria.pitchedInLine,
      trueDesc: 'Ball pitched in line with the stumps or on the off side',
      falseDesc: 'Ball pitched outside leg stump - NOT OUT regardless of other factors'
    },
    { 
      key: 'impactInLine', 
      label: 'Impact in line', 
      value: criteria.impactInLine,
      trueDesc: 'Ball struck the pad in line with the stumps',
      falseDesc: 'Impact was outside the line of off stump'
    },
    { 
      key: 'legBeforeBat', 
      label: 'Leg before bat', 
      value: criteria.legBeforeBat,
      trueDesc: 'Pad was struck before any contact with the bat',
      falseDesc: 'Ball hit the bat or glove before striking the pad'
    },
    { 
      key: 'wouldHitWickets', 
      label: 'Ball would hit wickets', 
      value: criteria.wouldHitWickets,
      trueDesc: 'Ball trajectory shows it would hit the stumps',
      falseDesc: 'Ball was going over or missing the stumps'
    },
  ];

  // Generate decision explanation
  const getDecisionExplanation = () => {
    if (isOut) {
      return "The batsman is OUT because all four LBW criteria are satisfied: the ball pitched in line, struck the pad in line with the stumps, the leg was before the bat, and the ball was going on to hit the wickets.";
    }
    
    const failedCriteria: string[] = [];
    if (!criteria.pitchedInLine) {
      failedCriteria.push("the ball pitched outside leg stump");
    }
    if (!criteria.impactInLine) {
      failedCriteria.push("the impact was outside the line of off stump");
    }
    if (!criteria.legBeforeBat) {
      failedCriteria.push("the ball hit the bat before the pad");
    }
    if (!criteria.wouldHitWickets) {
      failedCriteria.push("the ball was missing the stumps");
    }
    
    return `The batsman is NOT OUT because ${failedCriteria.join(', ')}.`;
  };

  const handleExport = () => {
    // Simulated export - in real app, would generate PDF report
    const report = {
      decision,
      confidence,
      criteria,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lbw-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Main Decision Banner */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-8 text-center",
          isOut ? "gradient-out" : "gradient-not-out"
        )}
      >
        <div className="relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-2">
            {isOut ? 'OUT' : 'NOT OUT'}
          </h2>
          <p className="text-white/80 text-lg">Decision</p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Confidence Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Confidence Score</h3>
            <span className="text-2xl font-bold text-primary">{confidence.toFixed(1)}%</span>
          </div>
          
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-1000",
                isOut ? "bg-destructive" : "bg-success"
              )}
              style={{ width: `${confidence}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* LBW Criteria Breakdown */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">LBW Criteria</h3>
          
          <div className="space-y-3">
            {criteriaItems.map((item) => (
              <div
                key={item.key}
                className={cn(
                  "p-3 rounded-lg",
                  item.value ? "bg-success/10" : "bg-destructive/10"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{item.label}</span>
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full",
                      item.value ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                    )}
                  >
                    {item.value ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  </div>
                </div>
                <p className={cn(
                  "text-sm",
                  item.value ? "text-success" : "text-destructive"
                )}>
                  {item.value ? item.trueDesc : item.falseDesc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Decision Explanation */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-3">Decision Explanation</h3>
          <p className={cn(
            "text-base p-4 rounded-lg border-l-4",
            isOut 
              ? "bg-destructive/10 border-destructive text-foreground" 
              : "bg-success/10 border-success text-foreground"
          )}>
            {getDecisionExplanation()}
          </p>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Button onClick={handleExport} variant="outline" className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Export Report
      </Button>
    </div>
  );
}