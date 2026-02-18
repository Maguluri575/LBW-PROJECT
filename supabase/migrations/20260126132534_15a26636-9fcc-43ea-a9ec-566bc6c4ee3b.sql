-- Create table for LBW analysis history
CREATE TABLE public.lbw_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id TEXT NOT NULL,
  video_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('OUT', 'NOT_OUT')),
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  umpires_call BOOLEAN DEFAULT false,
  impact_point JSONB,
  wicket_point JSONB,
  trajectory JSONB,
  ball_speed NUMERIC(5,1),
  ball_spin NUMERIC(5,1),
  pitching_zone TEXT,
  impact_zone TEXT,
  file_hash TEXT,
  key_frames JSONB,
  analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, analysis_id)
);

-- Enable RLS
ALTER TABLE public.lbw_analyses ENABLE ROW LEVEL SECURITY;

-- Users can view their own analyses
CREATE POLICY "Users can view own analyses"
  ON public.lbw_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can insert own analyses"
  ON public.lbw_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own analyses
CREATE POLICY "Users can update own analyses"
  ON public.lbw_analyses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses"
  ON public.lbw_analyses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lbw_analyses_updated_at
  BEFORE UPDATE ON public.lbw_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_lbw_analyses_user_id ON public.lbw_analyses(user_id);
CREATE INDEX idx_lbw_analyses_created_at ON public.lbw_analyses(created_at DESC);