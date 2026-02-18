
-- Create user analysis settings table
CREATE TABLE public.analysis_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Pitch dimensions
  pitch_length NUMERIC NOT NULL DEFAULT 22, -- in yards
  pitch_width NUMERIC NOT NULL DEFAULT 10, -- in feet
  crease_distance NUMERIC NOT NULL DEFAULT 4, -- popping crease distance in feet
  -- Ball type
  ball_type TEXT NOT NULL DEFAULT 'tennis', -- tennis, tape, leather
  -- Stump dimensions
  stump_height NUMERIC NOT NULL DEFAULT 28, -- in inches
  stump_width NUMERIC NOT NULL DEFAULT 9, -- in inches (total width of 3 stumps)
  -- Analysis
  confidence_threshold NUMERIC NOT NULL DEFAULT 50, -- minimum confidence %
  -- Camera
  camera_angle TEXT NOT NULL DEFAULT 'side', -- side, semi-side, behind
  camera_distance TEXT NOT NULL DEFAULT 'medium', -- close, medium, far
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.analysis_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.analysis_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.analysis_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_analysis_settings_updated_at
BEFORE UPDATE ON public.analysis_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
