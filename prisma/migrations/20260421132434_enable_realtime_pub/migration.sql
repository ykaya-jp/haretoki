-- Enable Supabase Realtime publication for partner sync (Lv3)
-- Run once; safe to skip if already added (handled at deploy time).
alter publication supabase_realtime add table visit_ratings;
alter publication supabase_realtime add table venue_favorites;
alter publication supabase_realtime add table visits;
