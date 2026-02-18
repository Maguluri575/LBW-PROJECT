import { supabase } from '@/integrations/supabase/client';

export interface AnalysisSettings {
  pitch_length: number;
  pitch_width: number;
  crease_distance: number;
  pitch_surface: string;
  ball_type: string;
  stump_height: number;
  stump_width: number;
  confidence_threshold: number;
  camera_angle: string;
  camera_distance: string;
}

const DEFAULTS: AnalysisSettings = {
  pitch_length: 22,
  pitch_width: 10,
  crease_distance: 4,
  pitch_surface: 'concrete',
  ball_type: 'tennis',
  stump_height: 28,
  stump_width: 9,
  confidence_threshold: 50,
  camera_angle: 'side',
  camera_distance: 'medium',
};

export async function getSettings(): Promise<AnalysisSettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULTS;

  const { data, error } = await supabase
    .from('analysis_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return DEFAULTS;

  return {
    pitch_length: Number(data.pitch_length),
    pitch_width: Number(data.pitch_width),
    crease_distance: Number(data.crease_distance),
    pitch_surface: data.pitch_surface,
    ball_type: data.ball_type,
    stump_height: Number(data.stump_height),
    stump_width: Number(data.stump_width),
    confidence_threshold: Number(data.confidence_threshold),
    camera_angle: data.camera_angle,
    camera_distance: data.camera_distance,
  };
}

export async function saveSettings(settings: AnalysisSettings): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('analysis_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('analysis_settings')
      .update(settings as any)
      .eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('analysis_settings')
      .insert({ ...settings, user_id: user.id } as any);
    if (error) throw error;
  }
}
