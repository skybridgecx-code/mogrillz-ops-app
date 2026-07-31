# Shama's Kitchen Ops Deployment Runbook

This application controls live orders, inventory, and menu state. Treat every production release as an operations change, not only a frontend deployment.

## Release invariants

- Never deploy application code that requires a newer database schema before applying its migration.
- Never enable mock mode in production.
- Never run the first-admin bootstrap script from an untrusted machine.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.
- Keep the application release rollbackable without deleting additive database columns or audit records.

## Required environment

```dotenv
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
MOGRILLZ_MENU_IMAGE_BUCKET=menu-images
```

Optional bounded-loader controls:

```dotenv
MOGRILLZ_OPS_ORDER_HISTORY_LIMIT=500
MOGRILLZ_OPS_CUSTOMER_LIMIT=1000
MOGRILLZ_OPS_SUBSCRIBER_LIMIT=1000
MOGRILLZ_OPS_INSIGHT_LIMIT=50
```

## Preflight stop conditions

Stop the release if any of these are true:

- The target commit is not the reviewed pull-request head.
- GitHub Actions is not green for that exact commit.
- The production database identity is uncertain.
- A current database backup or point-in-time recovery path is unavailable.
- The migration has not been reviewed against the current production schema.
- Production environment variables are missing or mock mode is enabled.
- `npm run db:preflight` does not report schema version `2026073002` or newer.

## Migration-first release sequence

1. Record the release commit SHA and current production deployment identifier.
2. Confirm a current Supabase backup or point-in-time recovery capability.
3. Apply all prior migrations that production is missing.
4. Apply:

   ```text
   supabase/migrations/2026-07-30-order-lifecycle-hardening.sql
   ```

5. From a trusted environment with production credentials, run:

   ```bash
   npm ci
   npm run db:preflight
   ```

6. Confirm the command emits JSON with:

   ```json
   {
     "status": "pass",
     "requiredSchemaVersion": 2026073002,
     "actualSchemaVersion": 2026073002
   }
   ```

   A higher actual schema version is acceptable. A lower or missing version is a hard stop.

7. Deploy the reviewed application commit.
8. Perform the smoke checks below.
9. Keep the release under observation before merging or deleting the release branch.

## Production smoke checks

Use an authorized administrator account.

### Read path

- Sign in successfully.
- Confirm the dashboard reports live data, not demo data.
- Confirm orders, inventory, and menu load.
- Confirm the summary KPIs render and do not show the schema-version error.
- Confirm customer or insight failure does not make the core order board unavailable.

### Write path

Use a designated test order and test records. Do not use a real customer order for release validation.

- Update an inventory test record and confirm the saved value after refresh.
- Update a menu test record and confirm the public state after refresh.
- Move a test order through one valid transition.
- Retry the same transition request with the same idempotency key and confirm it is replayed rather than duplicated.
- Attempt an invalid transition and confirm the API returns a conflict without changing the order.
- Confirm `order_status_events` contains one event for the successful request.
- Confirm completing pickup requires operator confirmation in the UI.

### Image path

- Upload a small test image to a test menu item.
- Confirm the database records `image_url`, `image_path`, and `image_bucket`.
- Confirm replacing the image removes the old object or emits a cleanup warning without losing the new image.

## Rollback

The migration is additive. Do not drop lifecycle columns, the status-event table, or audit records during an application rollback.

If the application release is unhealthy:

1. Stop operator writes if data integrity is in doubt.
2. Roll Vercel back to the previously verified application deployment.
3. Leave the additive database migration in place.
4. Verify that the previous application can still read orders, inventory, and menu data.
5. Inspect structured server logs using request IDs from failed API responses.
6. Repair forward on a new branch rather than rewriting or deleting audit history.

Restore the database only when there is confirmed data corruption and after preserving all available evidence.

## Post-release evidence

Record:

- Deployed commit SHA
- Migration file and schema version
- `db:preflight` output
- GitHub Actions run ID
- Vercel deployment ID
- Smoke-test results
- Any warnings or degraded sections
- Rollback decision and operator responsible
