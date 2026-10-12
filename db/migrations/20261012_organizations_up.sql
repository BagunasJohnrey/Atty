-- Organizations registry: Neon primary for the /organizations CRUD and the
-- report letterhead. One row per organizer; the app is the only writer.
-- Apply to ONE branch at a time (dev first, verify, then production).
-- Email is stored lowercase (enforced app-side); normalize on import.
create table organizations (
  id    text primary key,  -- ORG-XXX
  name  text not null,
  email text not null default ''
);
