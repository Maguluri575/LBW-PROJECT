import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/lbw/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMetricsData } from '@/services/lbwService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import type { MetricsData } from '@/types/lbw';

export default function Metrics() {
  const [data, setData] = useState<MetricsData | null>(null);

  useEffect(() => {
    getMetricsData().then(setData);
  }, []);

  if (!data) return <AppLayout><p>Loading...</p></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Performance analytics and statistics</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Overall Accuracy" value={`${data.accuracyMetrics.overall}%`} icon={<Target className="h-5 w-5" />} />
          <StatsCard title="Total Analyses" value={data.stats.totalAnalyses} icon={<Activity className="h-5 w-5" />} />
          <StatsCard title="False Positive Rate" value={`${data.accuracyMetrics.falsePositive}%`} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatsCard title="Avg Confidence" value={`${data.stats.averageConfidence}%`} icon={<TrendingUp className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Decision Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.decisionDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {data.decisionDistribution.map((entry, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(0, 75%, 55%)' : 'hsl(142, 70%, 45%)'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Weekly Analysis</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.timelineData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="out" stackId="a" fill="hsl(0, 75%, 55%)" />
                  <Bar dataKey="notOut" stackId="a" fill="hsl(142, 70%, 45%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}