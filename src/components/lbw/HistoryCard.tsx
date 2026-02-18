import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Film, Clock, Trash2 } from 'lucide-react';
import { deleteAnalysis } from '@/services/lbwService';
import { toast } from 'sonner';
import type { VideoHistoryItem } from '@/types/lbw';

interface HistoryCardProps {
  item: VideoHistoryItem;
  onDelete?: (id: string) => void;
}

export function HistoryCard({ item, onDelete }: HistoryCardProps) {
  const [deleting, setDeleting] = useState(false);
  const isOut = item.decision === 'OUT';

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteAnalysis(item.id);
      toast.success('Analysis deleted');
      onDelete?.(item.id);
    } catch {
      toast.error('Failed to delete analysis');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Link to={`/analysis/${item.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
        <div className="relative aspect-video bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <Badge
            className={cn(
              "absolute top-2 right-2",
              isOut ? "bg-destructive" : "bg-success"
            )}
          >
            {item.decision.replace('_', ' ')}
          </Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the analysis for "{item.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => { e.stopPropagation(); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <CardContent className="p-4">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDistanceToNow(item.analyzedAt, { addSuffix: true })}</span>
            </div>
            
            <div className="text-sm">
              <span className="text-muted-foreground">Confidence: </span>
              <span className="font-medium">{item.confidence.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}