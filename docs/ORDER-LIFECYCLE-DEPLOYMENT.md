# Order Lifecycle Hardening Deployment

This change introduces an application route that depends on the atomic `transition_order_status` PostgreSQL function.

## Required order

1. Apply `supabase/migrations/2026-07-31-order-lifecycle-hardening.sql` to the target Supabase project.
2. Verify the migration completed successfully.
3. Deploy the matching application commit.
4. Exercise one non-production or test order through `New -> In Prep -> Ready -> Picked Up`.
5. Confirm three rows were written to `order_status_events` and the order lifecycle timestamps were populated.

## Stop conditions

Do not deploy the application before the migration.

Stop and roll back the application deployment if the status endpoint reports that the lifecycle migration is missing. The migration itself is additive and should not be removed after lifecycle events have been recorded.

## Production actions not included

This repository change does not apply the migration, deploy the app, or mutate production data.
