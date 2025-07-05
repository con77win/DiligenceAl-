-- Add missing content_source column to analyses table
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS content_source TEXT;

-- Update the analyses table with additional fields for better tracking
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS processing_time INTEGER DEFAULT 0;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS perplexity_data JSONB;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON analyses;

CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pitch-decks', 'pitch-decks', false)
ON CONFLICT (id) DO NOTHING;

-- Update storage policies
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
