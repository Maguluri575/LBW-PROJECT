import { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Film, X, Camera, Video, Square, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface VideoUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  fileReadProgress?: number;
  isReadingFile?: boolean;
}

type Mode = 'select' | 'upload' | 'camera';

export function VideoUploader({ onFileSelect, disabled, fileReadProgress = 0, isReadingFile = false }: VideoUploaderProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview({ file, url });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
    maxFiles: 1,
    disabled,
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      
      setCameraStream(stream);
      setMode('camera');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
    setMode('select');
  };

  const startRecording = () => {
    if (!cameraStream) return;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(cameraStream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `cricket-video-${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreview({ file, url });
      stopCamera();
    };
    
    mediaRecorder.start(100);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnalyze = () => {
    if (preview) {
      onFileSelect(preview.file);
    }
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      setMode('select');
    }
  };

  // Preview mode - show recorded/uploaded video
  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden bg-muted">
          <video
            src={preview.url}
            controls
            className="w-full max-h-[400px] object-contain"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
            disabled={disabled || isReadingFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* File Reading Progress Bar */}
        {isReadingFile && (
          <div className="p-4 bg-muted/50 rounded-lg border border-primary/20 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Reading video content...
                </p>
                <p className="text-xs text-muted-foreground">
                  Generating fingerprint for consistent analysis
                </p>
              </div>
              <span className="text-sm font-mono text-primary">
                {Math.round(fileReadProgress)}%
              </span>
            </div>
            <Progress value={fileReadProgress} className="h-2" />
          </div>
        )}
        
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <Film className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium truncate max-w-[200px] sm:max-w-none">
                {preview.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(preview.file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          
          <Button onClick={handleAnalyze} disabled={disabled || isReadingFile} className="gap-2">
            {isReadingFile ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Analyze Video
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Camera recording mode
  if (mode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[400px] object-contain"
          />
          
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-background/50 hover:bg-background/80"
            onClick={stopCamera}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button 
              onClick={startRecording}
              size="lg"
              className="gap-2 bg-destructive hover:bg-destructive/90"
            >
              <Video className="h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <Button 
              onClick={stopRecording}
              size="lg"
              variant="outline"
              className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
            >
              <Square className="h-5 w-5" />
              Stop Recording
            </Button>
          )}
        </div>
        
        <p className="text-center text-sm text-muted-foreground">
          Position camera to capture the bowling and batting action from side view
        </p>
      </div>
    );
  }

  // Upload mode
  if (mode === 'upload') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setMode('select')}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
            isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <p className="text-lg font-semibold">
                {isDragActive ? 'Drop the video here' : 'Upload Cricket Video'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag and drop or click to select
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Supports MP4, MOV, AVI, WebM • Max 100MB
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mode selection (default)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        onClick={() => setMode('upload')}
        disabled={disabled}
        className={cn(
          "flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed transition-all",
          "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Upload Video</p>
          <p className="text-sm text-muted-foreground mt-1">
            Select from device
          </p>
        </div>
      </button>
      
      <button
        onClick={startCamera}
        disabled={disabled}
        className={cn(
          "flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed transition-all",
          "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="w-16 h-16 rounded-full bg-cricket/10 flex items-center justify-center">
          <Camera className="h-8 w-8 text-cricket" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Record Video</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use device camera
          </p>
        </div>
      </button>
    </div>
  );
}
