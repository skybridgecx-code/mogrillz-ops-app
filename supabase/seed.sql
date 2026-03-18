-- MoGrillz Ops starter seed
-- Insert a small believable dataset so the admin app opens with useful sample data.

insert into customers (id, name, email, phone, zone, total_orders, lifetime_value_cents, notes, loyalty_tier)
values
  ('11111111-1111-1111-1111-111111111111', 'Ayesha Khan', 'ayesha@example.com', '703-555-0101', 'Herndon', 6, 24400, 'Prefers extra herb chutney and earlier delivery windows.', 'high'),
  ('22222222-2222-2222-2222-222222222222', 'Hamza Ali', 'hamza@example.com', '703-555-0102', 'Sterling', 4, 15700, 'Leans wings plus one bowl. Good candidate for combo offers.', 'rising'),
  ('33333333-3333-3333-3333-333333333333', 'Fatima Noor', 'fatima@example.com', '703-555-0103', 'Vienna', 8, 31800, 'Often orders for small office groups and adds custom requests.', 'vip'),
  ('44444444-4444-4444-4444-444444444444', 'Omar Siddiqui', 'omar@example.com', '703-555-0104', 'Fairfax', 3, 9400, 'New repeat potential. Likes milder customization on spicy items.', 'new')
on conflict (id) do nothing;

insert into menu_items (id, slug, name, category, price_cents, availability, allocation_limit, description, is_featured, notes)
values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'nihari-tacos', 'Nihari Tacos', 'signature', 1800, 'live', 86, 'Slow-braised nihari beef with herb chutney and pickled onion.', true, 'Keep featured. Strongest first-order hook.'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'lamb-sliders', 'Lamb Sliders', 'premium special', 1800, 'live', 63, 'Spiced lamb patties with toum and pickled onion on soft buns.', true, 'Profitable and premium. Great for limited quantity messaging.'),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'lamb-bowl', 'Lamb Bowl', 'build your bowl', 1700, 'live', 71, 'Lamb over basmati rice or greens with bowl toppings and sauces.', true, 'Strong upsell with families and office orders.'),
  ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'karachi-hot-wings', 'Karachi Hot Wings', 'wings', 1500, 'live', 78, 'Bold heat with Karachi-style masala and a crisp finish.', false, 'Reliable repeat-order item in Herndon and Sterling.'),
  ('aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bihari-roll', 'Bihari Roll', 'rolls', 1600, 'watch', 34, 'Bihari-style beef wrapped in paratha with chutney and onion.', false, 'Protein coverage is tighter. Keep flexible for the next drop.')
on conflict (id) do nothing;

insert into inventory_items (id, name, unit, on_hand_qty, par_level, status, location, reorder_threshold, notes)
values
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Beef Nihari', 'portions', 18, 10, 'healthy', 'hot line', 8, 'Anchor item for preorder demand.'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Lamb', 'portions', 11, 8, 'watch', 'prep cooler', 6, 'Enough for current cycle, but not much slack.'),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Chicken', 'portions', 26, 12, 'healthy', 'prep cooler', 10, 'Stable coverage across bowls and rolls.'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Red Pickled Onions', 'trays', 2, 3, 'low', 'garnish station', 3, 'Likely to bottleneck bowl and roll finish.'),
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'Cilantro', 'trays', 1, 2, 'low', 'garnish station', 2, 'Restock before next preorder opens.'),
  ('bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'Cheese', 'packs', 5, 3, 'healthy', 'cold hold', 2, 'Good bowl topping coverage.'),
  ('bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'Garlic Toum', 'pans', 1.5, 1, 'watch', 'cold hold', 1, 'Used heavily by slider orders.')
on conflict (id) do nothing;

insert into orders (id, order_number, customer_id, customer_name, customer_email, status, drop_day, delivery_window, zone, total_cents, custom_request, delivery_notes, payment_provider, payment_status)
values
  ('c1111111-1111-1111-1111-111111111111', 'MG-1051', '11111111-1111-1111-1111-111111111111', 'Ayesha Khan', 'ayesha@example.com', 'ready', 'Wednesday', '6:30 PM - 7:00 PM', 'Herndon', 5400, 'No utensils please. Call on arrival.', 'Leave at the side door after text.', 'Stripe', 'paid'),
  ('c2222222-2222-2222-2222-222222222222', 'MG-1052', '22222222-2222-2222-2222-222222222222', 'Hamza Ali', 'hamza@example.com', 'in prep', 'Wednesday', '7:00 PM - 7:30 PM', 'Sterling', 3200, 'Please text instead of calling.', 'Hand off at front desk if needed.', 'Stripe', 'paid'),
  ('c3333333-3333-3333-3333-333333333333', 'MG-1053', '33333333-3333-3333-3333-333333333333', 'Fatima Noor', 'fatima@example.com', 'delivered', 'Friday', '5:45 PM - 6:15 PM', 'Vienna', 4100, 'Leave at the front desk.', 'Delivered to reception with signature note.', 'Stripe', 'paid'),
  ('c4444444-4444-4444-4444-444444444444', 'MG-1054', '44444444-4444-4444-4444-444444444444', 'Omar Siddiqui', 'omar@example.com', 'new', 'Friday', '7:30 PM - 8:00 PM', 'Fairfax', 2700, 'Ring the bell once.', 'Customer requested mild spice on the roll.', 'Stripe', 'paid')
on conflict (id) do nothing;

insert into order_items (order_id, menu_item_id, name, quantity, unit_price_cents, customizations, notes)
values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Nihari Tacos', 2, 1800, '["extra green chutney"]'::jsonb, 'Signature item'),
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Lamb Bowl', 1, 1700, '["cilantro","cheese","no onions"]'::jsonb, 'Bowl customization'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Karachi Hot Wings', 1, 1500, '["extra ranch"]'::jsonb, 'Sauce on the side'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Chicken Bowl', 1, 1700, '["light rice","extra cucumbers"]'::jsonb, 'Medium bowl'),
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'Bihari Roll', 1, 1600, '["normal spice"]'::jsonb, 'Delivered order'),
  ('c4444444-4444-4444-4444-444444444444', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Lamb Sliders', 2, 1800, '["one no onions"]'::jsonb, 'Office order')
on conflict do nothing;

insert into insights (id, type, title, summary, confidence, action_text, source, is_active)
values
  ('d1111111-1111-1111-1111-111111111111', 'prep', 'Increase lamb prep', 'Bowl conversions are up and lamb remains a high-value item for the next Wednesday drop.', 94, 'Shift one tray of garnish support toward bowl assembly.', 'sales trend', true),
  ('d2222222-2222-2222-2222-222222222222', 'demand', 'Wings plus one bowl is rising', 'Herndon and Sterling orders are clustering around wings plus a bowl. Combo testing makes sense.', 87, 'Try a limited combo CTA in the next campaign.', 'order mix', true),
  ('d3333333-3333-3333-3333-333333333333', 'ops', 'Red onions and cilantro are the bottleneck', 'The garnish line is the first place service could slow if order pace holds.', 92, 'Prep onions tonight and restock cilantro before the next preorder opens.', 'inventory', true),
  ('d4444444-4444-4444-4444-444444444444', 'content', 'Real halal, small batch, no shortcuts', 'The cleanest message this week still matches the founder-led brand and premium trust angle.', 89, 'Push this into the next drop post and the voice AI greeting.', 'brand strategy', true)
on conflict (id) do nothing;
