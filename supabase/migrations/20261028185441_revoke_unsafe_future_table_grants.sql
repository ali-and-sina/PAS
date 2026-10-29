-- The reviewed public tables are owned by postgres. Restrict defaults for future
-- application migrations as well as the existing table grants hardened earlier.
-- supabase_admin is platform-managed and cannot be assumed by the project role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM anon, authenticated;
