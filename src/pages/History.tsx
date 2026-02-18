import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { HistoryCard } from '@/components/lbw/HistoryCard';
import { getVideoHistory } from '@/services/lbwService';
import type { VideoHistoryItem } from '@/types/lbw';

export default function History() {
  const [items, setItems] = useState<VideoHistoryItem[]>([]);

  useEffect(() => {
    getVideoHistory().then(setItems);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis History</h1>
          <p className="text-muted-foreground mt-1">All previously analyzed videos</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <HistoryCard key={item.id} item={item} onDelete={(id) => setItems(prev => prev.filter(i => i.id !== id))} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}