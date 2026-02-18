import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { VideoUploader } from '@/components/lbw/VideoUploader';
import { AnalysisSteps } from '@/components/lbw/AnalysisSteps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { analyzeVideo } from '@/services/lbwService';
import { storeVideo, cleanupOldVideos } from '@/services/videoStorage';
import { AlertCircle, RefreshCw, Server, Wifi } from 'lucide-react';
import type { AnalysisStep } from '@/types/lbw';

interface AnalysisError {
  title: string;
  message: string;
  details?: string;
  isConnectionError: boolean;
}

function parseError(error: unknown): AnalysisError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Connection/Network errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
    return {
      title: 'Backend Connection Failed',
      message: 'Unable to connect to the analysis server. Make sure the Flask backend is running.',
      details: 'Start the backend with: cd backend && python app.py',
      isConnectionError: true,
    };
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
    return {
      title: 'Request Timeout',
      message: 'The analysis request took too long. The video might be too large or the server is overloaded.',
      details: 'Try with a smaller video file or wait a moment before retrying.',
      isConnectionError: false,
    };
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return {
      title: 'Server Error',
      message: 'The analysis server encountered an internal error while processing your video.',
      details: errorMessage,
      isConnectionError: false,
    };
  }
  
  // Analysis-specific errors
  if (errorMessage.includes('Analysis failed:')) {
    return {
      title: 'Analysis Failed',
      message: errorMessage.replace('Analysis failed:', '').trim(),
      isConnectionError: false,
    };
  }
  
  // File format errors
  if (errorMessage.includes('format') || errorMessage.includes('codec') || errorMessage.includes('unsupported')) {
    return {
      title: 'Unsupported Video Format',
      message: 'The video format is not supported. Please use MP4, AVI, MOV, or WebM.',
      details: errorMessage,
      isConnectionError: false,
    };
  }
  
  // Generic error
  return {
    title: 'Analysis Error',
    message: errorMessage || 'An unexpected error occurred during analysis.',
    isConnectionError: false,
  };
}

export default function Upload() {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setLastFile(file);
    setIsAnalyzing(true);
    setIsReadingFile(true);
    setFileReadProgress(0);
    setSteps([
      { id: 'preprocessing', name: 'Frame Preprocessing', description: 'Extracting frames', status: 'pending' },
      { id: 'ball-detection', name: 'Ball Detection', description: 'Finding ball position', status: 'pending' },
      { id: 'leg-detection', name: 'Leg Detection', description: 'Detecting leg region', status: 'pending' },
      { id: 'impact-detection', name: 'Impact Analysis', description: 'Finding contact point', status: 'pending' },
      { id: 'bounce-detection', name: 'Bounce Detection', description: 'Locating bounce', status: 'pending' },
      { id: 'trajectory', name: 'Trajectory Calculation', description: 'Computing path', status: 'pending' },
      { id: 'wicket-prediction', name: 'Wicket Prediction', description: 'Predicting outcome', status: 'pending' },
    ]);

    try {
      const result = await analyzeVideo(
        file, 
        (updatedStep) => {
          setSteps(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
        },
        (progress) => {
          setFileReadProgress(progress);
          if (progress >= 100) {
            setIsReadingFile(false);
          }
        }
      );

      // Store the video for replay in comparison view
      try {
        await storeVideo(result.id, file);
        await cleanupOldVideos(10);
      } catch (storageError) {
        console.error('Failed to store video for replay:', storageError);
      }

      navigate(`/analysis/${result.id}`);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(parseError(err));
      setIsAnalyzing(false);
      setIsReadingFile(false);
      
      // Mark current step as error
      setSteps(prev => prev.map(step => 
        step.status === 'processing' 
          ? { ...step, status: 'error' as const }
          : step
      ));
    }
  };

  const handleRetry = () => {
    if (lastFile) {
      handleFileSelect(lastFile);
    }
  };

  const handleDismissError = () => {
    setError(null);
    setSteps([]);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
          <p className="text-muted-foreground mt-1">Upload a cricket video to analyze LBW decision</p>
        </div>

        {error && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <div className="flex items-start gap-3">
              {error.isConnectionError ? (
                <Server className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <AlertTitle className="text-lg font-semibold">{error.title}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{error.message}</p>
                  {error.details && (
                    <code className="block text-xs bg-background/50 p-2 rounded border border-border/50 font-mono">
                      {error.details}
                    </code>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRetry}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry Analysis
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleDismissError}
                    >
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Upload Video</CardTitle>
          </CardHeader>
          <CardContent>
            <VideoUploader 
              onFileSelect={handleFileSelect} 
              disabled={isAnalyzing}
              isReadingFile={isReadingFile}
              fileReadProgress={fileReadProgress}
            />
          </CardContent>
        </Card>

        {isAnalyzing && (
          <Card>
            <CardHeader>
              <CardTitle>Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisSteps steps={steps} interactive={false} />
            </CardContent>
          </Card>
        )}

        {steps.some(s => s.status === 'error') && !isAnalyzing && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Processing Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisSteps steps={steps} interactive={false} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}