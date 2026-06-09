import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://wwpamkmxgoljvhidthsz.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cGFta214Z29sanZoaWR0aHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzY0OTMsImV4cCI6MjA5NjUxMjQ5M30.QS-hUV_1Rwl9ezWR4-e_5VUEtEgqN7oXJT260oGAETA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
