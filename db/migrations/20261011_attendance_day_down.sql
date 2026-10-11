-- Rollback for 20261011_attendance_day_up: restores the
-- (event_id, srcode) primary key. Same-day duplicates become possible
-- again, so only roll back together with the pre-per-day code.
alter table attendance drop constraint attendance_pkey;
alter table attendance drop column day;
alter table attendance add primary key (event_id, srcode);
