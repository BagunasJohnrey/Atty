-- Rollback for 20261012_organizations_up: drops the registry. Only roll
-- back together with the pre-cutover code path (NEON_ORGANIZATIONS unset),
-- or organizers created in Neon are lost — export them first, see the
-- rollback query in docs/modules/neon.md.
drop table organizations;
