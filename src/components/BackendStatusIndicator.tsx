import { useBackendStatus } from '@/hooks/useBackendStatus';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BackendStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function BackendStatusIndicator({ 
  className, 
  showLabel = true 
}: BackendStatusIndicatorProps) {
  const { isOnline, isChecking, lastChecked, retryCount, checkStatus } = useBackendStatus();

  const formatLastChecked = () => {
    if (!lastChecked) return 'Never';
    const seconds = Math.floor((Date.now() - lastChecked.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isChecking && "bg-muted text-muted-foreground",
              !isChecking && isOnline && "bg-green-500/10 text-green-600 dark:text-green-400",
              !isChecking && !isOnline && "bg-destructive/10 text-destructive"
            )}>
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isOnline ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              {showLabel && (
                <span>
                  {isChecking ? 'Checking...' : isOnline ? 'Backend Online' : 'Backend Offline'}
                </span>
              )}
            </div>
            
            {!isOnline && !isChecking && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkStatus()}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {isOnline ? 'Flask Backend Connected' : 'Flask Backend Unavailable'}
            </p>
            <p className="text-muted-foreground">
              Last checked: {formatLastChecked()}
            </p>
            {!isOnline && retryCount > 0 && (
              <p className="text-muted-foreground">
                Retry attempts: {retryCount}
              </p>
            )}
            {!isOnline && (
              <p className="text-xs text-muted-foreground mt-2">
                Make sure the Flask server is running on localhost:5000
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
