import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle,
  Film,
  CircleDot,
  Footprints,
  Crosshair,
  ArrowDown,
  TrendingUp,
  Target
} from 'lucide-react';
import type { AnalysisStep } from '@/types/lbw';

interface AnalysisStepsProps {
  steps: AnalysisStep[];
  interactive?: boolean;
}

const stepIcons: Record<string, React.ReactNode> = {
  'preprocessing': <Film className="h-5 w-5" />,
  'ball-detection': <CircleDot className="h-5 w-5" />,
  'leg-detection': <Footprints className="h-5 w-5" />,
  'impact-detection': <Crosshair className="h-5 w-5" />,
  'bounce-detection': <ArrowDown className="h-5 w-5" />,
  'trajectory': <TrendingUp className="h-5 w-5" />,
  'wicket-prediction': <Target className="h-5 w-5" />,
};

const stepDetails: Record<string, { description: string; visual: string }> = {
  'preprocessing': {
    description: 'Video frames are extracted at 30 FPS and normalized for consistent lighting and color balance. Background subtraction is applied to isolate moving objects.',
    visual: 'Frame extraction: 150 frames processed • Resolution: 720p • Format: RGB normalized',
  },
  'ball-detection': {
    description: 'Using Hough Circle Transform and color-based filtering to detect the red cricket ball in each frame. Object tracking maintains ball identity across frames.',
    visual: 'Ball detected in 142/150 frames • Average confidence: 94.2% • Tracking ID: BALL_001',
  },
  'leg-detection': {
    description: 'YOLO-based pose estimation identifies the batsman\'s leg region. Bounding box coordinates are extracted for the front and back leg positions.',
    visual: 'Leg region: [x: 234, y: 156, w: 45, h: 120] • Confidence: 91.8%',
  },
  'impact-detection': {
    description: 'Intersection analysis between ball trajectory and leg bounding box determines the exact impact point and frame number.',
    visual: 'Impact frame: #87 • Contact point: (245, 198) • Impact velocity: 22.4 m/s',
  },
  'bounce-detection': {
    description: 'Vertical velocity analysis identifies the pitch contact point. Ground plane estimation determines if ball bounced in legal zone.',
    visual: 'Bounce frame: #52 • Ground contact: (156, 340) • Bounce angle: 18.4°',
  },
  'trajectory': {
    description: 'Polynomial curve fitting extrapolates the ball path from release to stump line. Physics-based modeling accounts for spin and air resistance.',
    visual: 'Trajectory type: In-swinger • Deviation: 4.2cm • Extrapolation confidence: 89.1%',
  },
  'wicket-prediction': {
    description: 'Stump coordinates are mapped and intersection with extrapolated trajectory determines if the ball would have hit the wickets.',
    visual: 'Predicted impact: Middle stump (23cm from off) • Hit probability: 94.5%',
  },
};

function StatusIcon({ status }: { status: AnalysisStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'processing':
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

export function AnalysisSteps({ steps, interactive = true }: AnalysisStepsProps) {
  if (!interactive) {
    return (
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-colors",
              step.status === 'completed' && "bg-success/10",
              step.status === 'processing' && "bg-primary/10",
              step.status === 'error' && "bg-destructive/10",
              step.status === 'pending' && "bg-muted"
            )}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background">
              {stepIcons[step.id] || <Circle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{step.name}</p>
              <p className="text-sm text-muted-foreground truncate">{step.description}</p>
            </div>
            <StatusIcon status={step.status} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Analysis Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {steps.map((step, index) => (
            <AccordionItem key={step.id} value={step.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full",
                      step.status === 'completed' && "bg-success/20 text-success",
                      step.status === 'processing' && "bg-primary/20 text-primary",
                      step.status === 'error' && "bg-destructive/20 text-destructive",
                      step.status === 'pending' && "bg-muted text-muted-foreground"
                    )}
                  >
                    {stepIcons[step.id]}
                  </div>
                  <div>
                    <p className="font-medium">{step.name}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-11 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {stepDetails[step.id]?.description}
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-mono text-muted-foreground">
                      {stepDetails[step.id]?.visual}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={step.status} />
                    <span className="text-sm capitalize">{step.status}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}