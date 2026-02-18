import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/lbw/StatsCard';
import { HistoryCard } from '@/components/lbw/HistoryCard';
import { Button } from '@/components/ui/button';
import { getDashboardStats, getRecentAnalyses } from '@/services/lbwService';
import { Activity, CheckCircle, XCircle, TrendingUp, Plus } from 'lucide-react';
import type { DashboardStats, AnalysisResult } from '@/types/lbw';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [statsData, analyses] = await Promise.all([
        getDashboardStats(),
        getRecentAnalyses(3),
      ]);
      setStats(statsData);
      setRecentAnalyses(analyses);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">LBW Decision Support System Overview</p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/upload">
              <Plus className="h-4 w-4" />
              New Analysis
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Analyses"
              value={stats.totalAnalyses}
              icon={<Activity className="h-5 w-5" />}
              trend={{ value: 12, positive: true }}
            />
            <StatsCard
              title="OUT Decisions"
              value={stats.outDecisions}
              icon={<XCircle className="h-5 w-5" />}
            />
            <StatsCard
              title="NOT OUT Decisions"
              value={stats.notOutDecisions}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <StatsCard
              title="Avg Confidence"
              value={`${stats.averageConfidence}%`}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Recent Analyses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Analyses</h2>
            <Button variant="ghost" asChild>
              <Link to="/history">View All</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentAnalyses.map((analysis) => (
              <HistoryCard
                key={analysis.id}
                item={{
                  id: analysis.id,
                  name: analysis.videoName,
                  thumbnail: analysis.videoThumbnail,
                  decision: analysis.decision,
                  confidence: analysis.confidence,
                  analyzedAt: analysis.createdAt,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}