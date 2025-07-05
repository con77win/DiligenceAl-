-- Complete database schema fix for DiligenceAI
-- This script ensures all required columns exist and fixes any schema issues

-- First, let's check and add all missing columns to the analyses table
ALTER TABLE analyses 
ADD COLUMN IF NOT EXISTS content_source TEXT,
ADD COLUMN IF NOT EXISTS overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
ADD COLUMN IF NOT EXISTS processing_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS perplexity_data JSONB;

-- Update existing records to have default values for new columns
UPDATE analyses 
SET 
  content_source = COALESCE(content_source, 'Unknown'),
  overall_score = COALESCE(overall_score, 0),
  processing_time = COALESCE(processing_time, 0)
WHERE content_source IS NULL OR overall_score IS NULL OR processing_time IS NULL;

-- Ensure the analyses table has all required columns with proper constraints
DO $$ 
BEGIN
  -- Check if risk_level column exists and has proper constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'analyses_risk_level_check'
  ) THEN
    ALTER TABLE analyses ADD CONSTRAINT analyses_risk_level_check 
    CHECK (risk_level IN ('low', 'medium', 'high'));
  END IF;

  -- Check if status column exists and has proper constraint  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'analyses_status_check'
  ) THEN
    ALTER TABLE analyses ADD CONSTRAINT analyses_status_check 
    CHECK (status IN ('processing', 'completed', 'failed'));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_risk_level ON analyses(risk_level);

-- Ensure RLS is enabled and policies are correct
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON analyses;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

-- Ensure storage bucket exists for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pitch-decks', 'pitch-decks', false)
ON CONFLICT (id) DO NOTHING;

-- Update storage policies for file handling
DROP POLICY IF EXISTS "Users can upload pitch decks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own pitch decks" ON storage.objects;

CREATE POLICY "Users can upload pitch decks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pitch-decks' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own pitch decks" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pitch-decks' AND 
    auth.uid() IS NOT NULL
  );

-- Ensure shared_reports table exists for shareable links
CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for shared reports
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create shared reports for own analyses" ON shared_reports;
DROP POLICY IF EXISTS "Users can view own shared reports" ON shared_reports;
DROP POLICY IF EXISTS "Public can view shared reports via token" ON shared_reports;

CREATE POLICY "Users can create shared reports for own analyses" ON shared_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM analyses 
      WHERE analyses.id = analysis_id 
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own shared reports" ON shared_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM analyses 
      WHERE analyses.id = analysis_id 
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view shared reports via token" ON shared_reports
  FOR SELECT USING (
    expires_at IS NULL OR expires_at > NOW()
  );

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
