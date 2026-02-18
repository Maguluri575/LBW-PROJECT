/**
 * Database service for LBW analysis storage
 * Uses  Cloud (Supabase) for persistent storage
 */
import { supabase } from '@/integrations/supabase/client';
import type { AnalysisResult, VideoHistoryItem, DashboardStats, Decision } from '@/types/lbw';
import type { TablesInsert } from '@/integrations/supabase/types';

type LbwAnalysisInsert = TablesInsert<'lbw_analyses'>;

// Convert AnalysisResult to database format
function toDbFormat(result: AnalysisResult, userId: string): LbwAnalysisInsert {
  return {
    user_id: userId,
    analysis_id: result.id,
    video_name: result.videoName,
    decision: result.decision,
    confidence: result.confidence,
    umpires_call: result.isUmpiresCall ?? false,
    impact_point: result.impactPoint as unknown as LbwAnalysisInsert['impact_point'],
    wicket_point: result.predictedWicketHit as unknown as LbwAnalysisInsert['wicket_point'],
    trajectory: result.trajectory as unknown as LbwAnalysisInsert['trajectory'],
    ball_speed: result.ballMetrics?.speed ?? null,
    ball_spin: result.ballMetrics?.spinRate ?? null,
    pitching_zone: result.pitchAnalysis?.zone ?? null,
    impact_zone: result.impactAnalysis?.zone ?? null,
    key_frames: result.keyFrames as unknown as LbwAnalysisInsert['key_frames'],
    analysis_timestamp: result.createdAt.toISOString(),
  };
}

// Convert database row to AnalysisResult
function fromDbFormat(row: Record<string, unknown>): Partial<AnalysisResult> {
  return {
    id: row.analysis_id as string,
    videoName: row.video_name as string,
    decision: row.decision as Decision,
    confidence: Number(row.confidence),
    isUmpiresCall: row.umpires_call as boolean,
    impactPoint: row.impact_point as { x: number; y: number },
    predictedWicketHit: row.wicket_point as { x: number; y: number } | null,
    trajectory: (row.trajectory as { x: number; y: number; z: number }[]) || [],
    createdAt: new Date(row.analysis_timestamp as string || row.created_at as string),
    keyFrames: row.key_frames as AnalysisResult['keyFrames'],
  };
}

/**
 * Save analysis result to database
 */
export async function saveAnalysisToDb(result: AnalysisResult): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No authenticated user, cannot save to database');
      return false;
    }

    const dbData = toDbFormat(result, user.id);

    // First try to find existing record
    const { data: existing } = await supabase
      .from('lbw_analyses')
      .select('id')
      .eq('user_id', user.id)
      .eq('analysis_id', result.id)
      .maybeSingle();

    let error;
    if (existing) {
      // Update existing record
      ({ error } = await supabase
        .from('lbw_analyses')
        .update(dbData)
        .eq('id', existing.id));
    } else {
      // Insert new record
      ({ error } = await supabase
        .from('lbw_analyses')
        .insert(dbData));
    }

    if (error) {
      console.error('Failed to save analysis to database:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error saving analysis:', err);
    return false;
  }
}

/**
 * Get analysis result by ID from database
 */
export async function getAnalysisFromDb(analysisId: string): Promise<Partial<AnalysisResult> | null> {
  try {
    const { data, error } = await supabase
      .from('lbw_analyses')
      .select('*')
      .eq('analysis_id', analysisId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch analysis from database:', error);
      return null;
    }

    if (!data) return null;

    return fromDbFormat(data as Record<string, unknown>);
  } catch (err) {
    console.error('Error fetching analysis:', err);
    return null;
  }
}

/**
 * Get all analyses for the current user
 */
export async function getVideoHistoryFromDb(): Promise<VideoHistoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('lbw_analyses')
      .select('analysis_id, video_name, decision, confidence, analysis_timestamp, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch history from database:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.analysis_id,
      name: row.video_name,
      thumbnail: '/placeholder.svg',
      decision: row.decision as Decision,
      confidence: Number(row.confidence),
      analyzedAt: new Date(row.analysis_timestamp || row.created_at),
    }));
  } catch (err) {
    console.error('Error fetching history:', err);
    return [];
  }
}

/**
 * Get dashboard stats from database
 */
export async function getDashboardStatsFromDb(): Promise<DashboardStats> {
  try {
    const { data, error } = await supabase
      .from('lbw_analyses')
      .select('decision, confidence');

    if (error) {
      console.error('Failed to fetch stats from database:', error);
      return { totalAnalyses: 0, outDecisions: 0, notOutDecisions: 0, averageConfidence: 0, accuracyRate: 0 };
    }

    const analyses = data || [];
    const total = analyses.length;
    
    if (total === 0) {
      return { totalAnalyses: 0, outDecisions: 0, notOutDecisions: 0, averageConfidence: 0, accuracyRate: 0 };
    }

    const outCount = analyses.filter((a) => a.decision === 'OUT').length;
    const avgConfidence = analyses.reduce((sum, a) => sum + Number(a.confidence), 0) / total;

    return {
      totalAnalyses: total,
      outDecisions: outCount,
      notOutDecisions: total - outCount,
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      accuracyRate: 87.5, // Placeholder - would need ground truth data
    };
  } catch (err) {
    console.error('Error fetching stats:', err);
    return { totalAnalyses: 0, outDecisions: 0, notOutDecisions: 0, averageConfidence: 0, accuracyRate: 0 };
  }
}

/**
 * Get recent analyses from database
 */
export async function getRecentAnalysesFromDb(limit: number = 3): Promise<Partial<AnalysisResult>[]> {
  try {
    const { data, error } = await supabase
      .from('lbw_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch recent analyses from database:', error);
      return [];
    }

    return (data || []).map((row) => fromDbFormat(row as Record<string, unknown>));
  } catch (err) {
    console.error('Error fetching recent analyses:', err);
    return [];
  }
}

/**
 * Delete analysis from database
 */
export async function deleteAnalysisFromDb(analysisId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('lbw_analyses')
      .delete()
      .eq('analysis_id', analysisId);

    if (error) {
      console.error('Failed to delete analysis from database:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting analysis:', err);
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export async function isUserAuthenticated(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}