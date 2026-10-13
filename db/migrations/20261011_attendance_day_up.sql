-- Per-day attendance: add the Manila-day column and promote the primary
-- key to (event_id, srcode, day). Apply to ONE branch at a time (dev
-- first, verify, then production). Existing rows keep their meaning:
-- each was the student's only scan, backfilled to its Manila day.
alter table attendance add column day date;
update attendance set day = (timezone('Asia/Manila', scanned_at))::date;
alter table attendance alter column day set not null;
alter table attendance drop constraint attendance_pkey;
alter table attendance add primary key (event_id, srcode, day);
