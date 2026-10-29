# Security regression suite

Run `npm ci --no-audit --no-fund`, then `npm run test:security`.

The database suite builds the reviewed schema snapshot in a fresh, in-memory PGlite database, applies the SQL migrations, and creates synthetic actors and clinical records. It never connects to Supabase. Every case uses `session_user=authenticator` and `current_user=authenticated` (or `anon`), checks that the service-role bypass is false, forces deferred constraints, and rolls back. It also checks the complete fixture state hash after the suite.

The snapshot in `fixtures/schema.sql` represents the existing hosted schema before this patch; it is a test fixture, not a production bootstrap migration. PGlite runs PostgreSQL 18, while the reviewed hosted project runs PostgreSQL 17. Live API verification is recorded separately in the delivery report.

The source suite executes the actual redirect, demo-login and PDF-validation helpers. The policy suite checks production CSP, development compatibility and signout origin validation. Local JSON results are written to `.security-results/`.

Any failed assertion exits with a nonzero status. Passing these tests is evidence for the listed cases; it does not guarantee the absence of other security defects.
