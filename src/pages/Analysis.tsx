import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { TrajectoryCanvas } from '@/components/lbw/TrajectoryCanvas';
import { DecisionDisplay } from '@/components/lbw/DecisionDisplay';
import { AnalysisSteps } from '@/components/lbw/AnalysisSteps';
import { BallSpeedometer } from '@/components/lbw/BallSpeedometer';
import { PitchMap } from '@/components/lbw/PitchMap';
import { ImpactZoneDisplay } from '@/components/lbw/ImpactZoneDisplay';
import { WicketZoneDisplay } from '@/components/lbw/WicketZoneDisplay';
import { UmpiresCallBadge } from '@/components/lbw/UmpiresCallBadge';
import { KeyFrameThumbnails } from '@/components/lbw/KeyFrameThumbnails';
import { KeyFrameReplay } from '@/components/lbw/KeyFrameReplay';
import { SideBySideComparison } from '@/components/lbw/SideBySideComparison';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAnalysisResult } from '@/services/lbwService';
import { getVideoUrl } from '@/services/videoStorage';
import { ArrowLeft } from 'lucide-react';
import type { AnalysisResult } from '@/types/lbw';

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [storedVideoUrl, setStoredVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      // Fetch analysis result and stored video URL in parallel
      Promise.all([
        getAnalysisResult(id),
        getVideoUrl(id)
      ]).then(([analysisResult, videoUrl]) => {
        setResult(analysisResult);
        setStoredVideoUrl(videoUrl);
      });
    }
  }, [id]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (storedVideoUrl) {
        URL.revokeObjectURL(storedVideoUrl);
      }
    };
  }, [storedVideoUrl]);

  if (!result) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/history"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{result.videoName}</h1>
              <p className="text-muted-foreground">DRS Analysis Results</p>
            </div>
          </div>
          {result.isUmpiresCall && (
            <UmpiresCallBadge isUmpiresCall={true} decision={result.decision} />
          )}
        </div>

        <div className="bg-card rounded-xl p-6 border">
          <h2 className="text-lg font-semibold mb-4">Hawk-Eye Ball Tracking</h2>
          <TrajectoryCanvas
            trajectory={result.trajectory}
            impactPoint={result.impactPoint}
            bouncePoint={result.bouncePoint}
            predictedWicketHit={result.predictedWicketHit}
            decision={result.decision}
          />
        </div>

        <Tabs defaultValue="decision" className="w-full">
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-7">
            <TabsTrigger value="decision">Decision</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="replay">Replay</TabsTrigger>
            <TabsTrigger value="frames">Frames</TabsTrigger>
            <TabsTrigger value="metrics" className="hidden md:flex">Ball Data</TabsTrigger>
            <TabsTrigger value="zones" className="hidden md:flex">Zones</TabsTrigger>
            <TabsTrigger value="steps" className="hidden md:flex">Process</TabsTrigger>
          </TabsList>

          <TabsContent value="decision" className="mt-4">
            <DecisionDisplay decision={result.decision} confidence={result.confidence} criteria={result.criteria} />
          </TabsContent>

          <TabsContent value="compare" className="mt-4">
            <SideBySideComparison keyFrames={result.keyFrames} videoUrl={storedVideoUrl || result.videoUrl} />
          </TabsContent>

          <TabsContent value="replay" className="mt-4">
            <KeyFrameReplay keyFrames={result.keyFrames} />
          </TabsContent>

          <TabsContent value="frames" className="mt-4">
            <KeyFrameThumbnails keyFrames={result.keyFrames} />
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {result.ballMetrics && <BallSpeedometer metrics={result.ballMetrics} />}
              {result.wicketPrediction && (
                <WicketZoneDisplay prediction={result.wicketPrediction} decision={result.decision} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="zones" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {result.pitchAnalysis && (
                <PitchMap analysis={result.pitchAnalysis} criteria={result.criteria} />
              )}
              {result.impactAnalysis && (
                <ImpactZoneDisplay analysis={result.impactAnalysis} criteria={result.criteria} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            <AnalysisSteps steps={result.steps} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}