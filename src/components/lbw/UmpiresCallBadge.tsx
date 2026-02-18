import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface UmpiresCallBadgeProps {
  isUmpiresCall: boolean;
  decision: 'OUT' | 'NOT_OUT';
  className?: string;
}

export function UmpiresCallBadge({ isUmpiresCall, decision, className }: UmpiresCallBadgeProps) {
  if (!isUmpiresCall) return null;
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed",
      "animate-pulse",
      decision === 'OUT' 
        ? "bg-amber-500/10 border-amber-500 text-amber-500"
        : "bg-amber-500/10 border-amber-500 text-amber-500",
      className
    )}>
      <AlertTriangle className="h-5 w-5" />
      <div className="flex flex-col">
        <span className="font-bold text-sm">UMPIRE'S CALL</span>
        <span className="text-xs opacity-80">
          Original decision stands - {decision === 'OUT' ? 'OUT' : 'NOT OUT'}
        </span>
      </div>
    </div>
  );
}