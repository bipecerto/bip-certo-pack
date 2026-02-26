CREATE OR REPLACE FUNCTION increment_processed_rows(inc_job_id UUID, count INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.import_jobs
  SET processed_rows = processed_rows + count
  WHERE id = inc_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
