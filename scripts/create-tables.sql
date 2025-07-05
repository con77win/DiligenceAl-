-- Create analyses table with enhanced fields
CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  content_source TEXT, -- Stores the source of content (PDF name, URL, etc.)
  file_path TEXT,
  data_room_url TEXT,
  public_url TEXT,
  additional_notes TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  red_flags_count INTEGER DEFAULT 0,
  overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Users can only see their own analyses
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can insert own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own analyses
CREATE POLICY "Users can update own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for pitch decks
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pitch-decks', 'pitch-decks', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for file uploads
CREATE POLICY "Users can upload pitch decks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pitch-decks' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own pitch decks" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pitch-decks' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create shared reports table for shareable links
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

-- Public access for shared reports (when accessed via share token)
CREATE POLICY "Public can view shared reports via token" ON shared_reports
  FOR SELECT USING (
    expires_at IS NULL OR expires_at > NOW()
  );
