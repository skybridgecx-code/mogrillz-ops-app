-- Remove the stale anonymous execute grant retained on the lifecycle RPC.
-- Authenticated operators keep execute permission through the original migration.

revoke execute
on function public.transition_order_status(uuid, text, uuid)
from anon;
