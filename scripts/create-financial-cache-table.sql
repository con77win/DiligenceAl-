-- Create financial_cache table with optimized structure
CREATE TABLE IF NOT EXISTS financial_cache (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    financial_data JSONB NOT NULL,
    source VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_financial_cache_company_name 
ON financial_cache USING gin(to_tsvector('english', company_name));

CREATE INDEX IF NOT EXISTS idx_financial_cache_domain 
ON financial_cache (domain);

CREATE INDEX IF NOT EXISTS idx_financial_cache_created_at 
ON financial_cache (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_cache_company_domain 
ON financial_cache (company_name, domain);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_financial_cache_lookup 
ON financial_cache (company_name, domain, created_at DESC);

-- Create GIN index for JSONB financial_data for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_financial_cache_financial_data 
ON financial_cache USING gin(financial_data);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_financial_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_financial_cache_updated_at
    BEFORE UPDATE ON financial_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_cache_updated_at();

-- Add Row Level Security (RLS) policies
ALTER TABLE financial_cache ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read all data
CREATE POLICY "Allow authenticated users to read financial cache" 
ON financial_cache FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to insert data
CREATE POLICY "Allow authenticated users to insert financial cache" 
ON financial_cache FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy to allow authenticated users to update their own data
CREATE POLICY "Allow authenticated users to update financial cache" 
ON financial_cache FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Create function to clean up old cache entries (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_financial_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM financial_cache 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get cache statistics
CREATE OR REPLACE FUNCTION get_financial_cache_stats()
RETURNS TABLE (
    total_entries BIGINT,
    unique_companies BIGINT,
    cache_hit_rate NUMERIC,
    avg_age_hours NUMERIC,
    top_sources TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT company_name) as unique_companies,
        ROUND(
            (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'))::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 2
        ) as cache_hit_rate,
        ROUND(
            EXTRACT(EPOCH FROM (NOW() - AVG(created_at))) / 3600, 2
        ) as avg_age_hours,
        ARRAY_AGG(DISTINCT source ORDER BY COUNT(*) DESC) as top_sources
    FROM financial_cache;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE financial_cache IS 'Cache table for storing financial data retrieved from various APIs and web scraping';
COMMENT ON COLUMN financial_cache.company_name IS 'Name of the company';
COMMENT ON COLUMN financial_cache.domain IS 'Company domain/website';
COMMENT ON COLUMN financial_cache.financial_data IS 'JSON object containing financial metrics';
COMMENT ON COLUMN financial_cache.source IS 'Source of the data (e.g., Crunchbase, SerpAPI, etc.)';
COMMENT ON COLUMN financial_cache.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN financial_cache.updated_at IS 'Timestamp when the record was last updated';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON financial_cache TO authenticated;
GRANT USAGE ON SEQUENCE financial_cache_id_seq TO authenticated;
