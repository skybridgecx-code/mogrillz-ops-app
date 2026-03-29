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
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'nihari-tacos', 'Nihari Tacos', 'signature', 1800, 'live', 86, 'Slow-braised nihari beef, pickled onion, herb chutney.', true, 'Keep featured. Strongest first-order hook.'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'lamb-sliders', 'Lamb Sliders', 'signature', 1800, 'live', 63, 'Spiced lamb patties, garlic toum, pickled red onion.', true, 'Profitable and premium. Great for limited quantity messaging.'),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'wings-karachi-6', 'Karachi Hot Wings (6pc)', 'wings', 1500, 'live', 78, 'Bold heat with Karachi-style masala and a crisp finish.', false, null),
  ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'wings-karachi-12', 'Karachi Hot Wings (12pc)', 'wings', 2600, 'live', 78, 'Bold heat with Karachi-style masala and a crisp finish.', false, null),
  ('aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'wings-honey-6', 'Honey Garlic Lahori Wings (6pc)', 'wings', 1500, 'live', 78, 'Sweet heat with a Lahori-style garlic finish.', false, null),
  ('aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'wings-honey-12', 'Honey Garlic Lahori Wings (12pc)', 'wings', 2600, 'live', 78, 'Sweet heat with a Lahori-style garlic finish.', false, null),
  ('aaaaaaa7-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'wings-buffalo-6', 'Buffalo Masala Wings (6pc)', 'wings', 1500, 'live', 78, 'Buffalo-style wings with a masala edge.', false, null),
  ('aaaaaaa8-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'wings-buffalo-12', 'Buffalo Masala Wings (12pc)', 'wings', 2600, 'live', 78, 'Buffalo-style wings with a masala edge.', false, null),
  ('aaaaaaa9-aaaa-aaaa-aaaa-aaaaaaaaaaa9', 'seekh-roll', 'Seekh Kabob Roll', 'rolls', 1400, 'live', 34, 'Seekh kabob wrapped in paratha with chutney and onion.', false, null),
  ('aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'bihari-roll', 'Bihari Roll', 'rolls', 1400, 'live', 34, 'Bihari-style beef wrapped in paratha with chutney and onion.', false, 'Keep flexible for the next drop.'),
  ('aaaaaaac-aaaa-aaaa-aaaa-aaaaaaaaaaac', 'chicken-shawarma', 'Chicken Shawarma Roll', 'rolls', 1400, 'live', 34, 'Chicken shawarma wrapped in paratha with sauces and crunch.', false, null),
  ('aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad', 'bowl-lamb', 'Lamb Bowl', 'bowls', 1700, 'live', 71, 'Tender lamb over basmati rice or greens with raita, green chutney, and your choice of bowl toppings.', false, 'Strong upsell with families and office orders.'),
  ('aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae', 'bowl-chicken', 'Chicken Bowl', 'bowls', 1500, 'live', 71, 'Marinated chicken over basmati rice or greens with raita, green chutney, and your choice of bowl toppings.', false, null)
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

insert into inventory_item_menu_links (inventory_item_id, menu_item_id)
values
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad'),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaac-aaaa-aaaa-aaaa-aaaaaaaaaaac'),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa9-aaaa-aaaa-aaaa-aaaaaaaaaaa9'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaab'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae'),
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad'),
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae'),
  ('bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad'),
  ('bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae'),
  ('bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2')
on conflict do nothing;

insert into orders (id, order_number, customer_id, customer_name, customer_email, status, drop_day, delivery_window, zone, total_cents, custom_request, delivery_notes, payment_provider, payment_status)
values
  ('c1111111-1111-1111-1111-111111111111', 'MG-1051', '11111111-1111-1111-1111-111111111111', 'Ayesha Khan', 'ayesha@example.com', 'Ready', 'Wednesday', '6:30 PM - 7:00 PM', 'Herndon', 5512, 'No utensils please. Call on arrival.', 'Leave at the side door after text.', 'Stripe', 'paid'),
  ('c2222222-2222-2222-2222-222222222222', 'MG-1052', '22222222-2222-2222-2222-222222222222', 'Hamza Ali', 'hamza@example.com', 'In Prep', 'Wednesday', '7:00 PM - 7:30 PM', 'Sterling', 3120, 'Please text instead of calling.', 'Hand off at front desk if needed.', 'Stripe', 'paid'),
  ('c3333333-3333-3333-3333-333333333333', 'MG-1053', '33333333-3333-3333-3333-333333333333', 'Fatima Noor', 'fatima@example.com', 'Delivered', 'Friday', '5:45 PM - 6:15 PM', 'Vienna', 1456, 'Leave at the front desk.', 'Delivered to reception with signature note.', 'Stripe', 'paid'),
  ('c4444444-4444-4444-4444-444444444444', 'MG-1054', '44444444-4444-4444-4444-444444444444', 'Omar Siddiqui', 'omar@example.com', 'New', 'Friday', '7:30 PM - 8:00 PM', 'Fairfax', 3744, 'Ring the bell once.', 'Customer requested mild spice on the roll.', 'Stripe', 'paid')
on conflict (id) do nothing;

insert into order_items (order_id, menu_item_id, name, quantity, unit_price_cents, customizations, notes)
values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Nihari Tacos', 2, 1800, '["extra green chutney"]'::jsonb, 'Signature item'),
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad', 'Lamb Bowl', 1, 1700, '["cilantro","cheese","no onions"]'::jsonb, 'Bowl customization'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Karachi Hot Wings (6pc)', 1, 1500, '["extra ranch"]'::jsonb, 'Sauce on the side'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae', 'Chicken Bowl', 1, 1500, '["light rice","extra cucumbers"]'::jsonb, 'Medium bowl'),
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'Bihari Roll', 1, 1400, '["normal spice"]'::jsonb, 'Delivered order'),
  ('c4444444-4444-4444-4444-444444444444', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Lamb Sliders', 2, 1800, '["one no onions"]'::jsonb, 'Office order')
on conflict do nothing;

insert into insights (id, type, title, summary, confidence, action_text, source, is_active)
values
  ('d1111111-1111-1111-1111-111111111111', 'prep', 'Increase lamb prep', 'Bowl conversions are up and lamb remains a high-value item for the next Wednesday drop.', 94, 'Shift one tray of garnish support toward bowl assembly.', 'sales trend', true),
  ('d2222222-2222-2222-2222-222222222222', 'demand', 'Wings plus one bowl is rising', 'Herndon and Sterling orders are clustering around wings plus a bowl. Combo testing makes sense.', 87, 'Try a limited combo CTA in the next campaign.', 'order mix', true),
  ('d3333333-3333-3333-3333-333333333333', 'ops', 'Red onions and cilantro are the bottleneck', 'The garnish line is the first place service could slow if order pace holds.', 92, 'Prep onions tonight and restock cilantro before the next preorder opens.', 'inventory', true),
  ('d4444444-4444-4444-4444-444444444444', 'content', 'Real halal, small batch, no shortcuts', 'The cleanest message this week still matches the founder-led brand and premium trust angle.', 89, 'Push this into the next drop post and the voice AI greeting.', 'brand strategy', true)
on conflict (id) do nothing;
