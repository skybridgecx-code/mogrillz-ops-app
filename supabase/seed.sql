-- MoGrillz Ops starter seed
-- Insert a small believable dataset so the admin app opens with useful sample data.

insert into customers (id, name, email, phone, zone, total_orders, lifetime_value_cents, notes, loyalty_tier)
values
  ('11111111-1111-1111-1111-111111111111', 'Ayesha Khan', 'ayesha@example.com', '703-555-0101', 'Herndon', 6, 24400, 'Prefers extra herb chutney and earlier pickup confirmations.', 'high'),
  ('22222222-2222-2222-2222-222222222222', 'Hamza Ali', 'hamza@example.com', '703-555-0102', 'Sterling', 4, 15700, 'Leans wings plus one bowl. Good candidate for combo offers.', 'rising'),
  ('33333333-3333-3333-3333-333333333333', 'Fatima Noor', 'fatima@example.com', '703-555-0103', 'Vienna', 8, 31800, 'Often orders for small office groups and adds custom requests.', 'vip'),
  ('44444444-4444-4444-4444-444444444444', 'Omar Siddiqui', 'omar@example.com', '703-555-0104', 'Fairfax', 3, 9400, 'New repeat potential. Likes milder customization on spicy items.', 'new')
on conflict (id) do nothing;

insert into menu_items (id, slug, name, category, price_cents, availability, allocation_limit, description, image_url, sort_order, is_featured, notes)
values
  -- SIGNATURE (Featured)
  ('a0000001-0001-0001-0001-000000000001', 'nihari-tacos', 'Nihari Tacos', 'signature', 1800, 'live', 50, 'Slow-braised nihari beef in fresh tortillas with pickled onion and herb chutney.', null, 10, true, 'Hero item. Best seller.'),
  ('a0000001-0001-0001-0001-000000000002', 'lamb-chops', 'Lamb Chops', 'signature', 2400, 'live', 30, 'Tandoori-marinated lamb chops with mint chutney and grilled onions.', null, 20, true, 'Premium signature item.'),

  -- ROLLS (Paratha Wraps)
  ('a0000002-0002-0002-0002-000000000001', 'chicken-tikka-roll', 'Chicken Tikka Roll', 'rolls', 1300, 'live', 60, 'Charred tikka chunks wrapped in flaky paratha with chutney and onions.', null, 100, false, null),
  ('a0000002-0002-0002-0002-000000000002', 'seekh-kebab-roll', 'Seekh Kebab Roll', 'rolls', 1300, 'live', 60, 'Spiced beef seekh kebab wrapped in paratha with green chutney.', null, 101, false, null),
  ('a0000002-0002-0002-0002-000000000003', 'bihari-kebab-roll', 'Bihari Kebab Roll', 'rolls', 1400, 'live', 60, 'Tender Bihari-style beef with caramelized onions in fresh paratha.', null, 102, false, null),
  ('a0000002-0002-0002-0002-000000000004', 'chapli-kebab-roll', 'Chapli Kebab Roll', 'rolls', 1300, 'live', 60, 'Peshawar-style chapli patty with tomatoes and coriander in paratha.', null, 103, false, null),
  ('a0000002-0002-0002-0002-000000000005', 'chicken-shawarma-roll', 'Chicken Shawarma Roll', 'rolls', 1300, 'live', 60, 'Lahori-spiced chicken shawarma with garlic toum and pickles.', null, 104, false, null),
  ('a0000002-0002-0002-0002-000000000006', 'malai-boti-roll', 'Malai Boti Roll', 'rolls', 1400, 'live', 60, 'Creamy, mildly-spiced chicken boti wrapped with raita drizzle.', null, 105, false, null),
  ('a0000002-0002-0002-0002-000000000007', 'gola-kebab-roll', 'Gola Kebab Roll', 'rolls', 1300, 'live', 60, 'Minced beef gola kebab with onions and tangy tamarind chutney.', null, 106, false, null),

  -- SANDWICHES & BURGERS
  ('a0000003-0003-0003-0003-000000000001', 'bun-kebab', 'Bun Kebab', 'sandwiches', 1200, 'live', 50, 'The OG Pakistani street burger — spiced patty, egg, chutney, crispy onions.', null, 200, false, 'Street food classic.'),
  ('a0000003-0003-0003-0003-000000000002', 'chapli-burger', 'Chapli Burger', 'sandwiches', 1300, 'live', 50, 'Chapli kebab patty in a toasted bun with raita and pickled chilies.', null, 201, false, null),
  ('a0000003-0003-0003-0003-000000000003', 'chicken-tikka-sandwich', 'Chicken Tikka Sandwich', 'sandwiches', 1300, 'live', 50, 'Grilled tikka chunks on toasted bread with mint mayo and veggies.', null, 202, false, null),
  ('a0000003-0003-0003-0003-000000000004', 'seekh-kebab-sandwich', 'Seekh Kebab Sandwich', 'sandwiches', 1200, 'live', 50, 'Seekh kebab on a hoagie with green chutney and onion rings.', null, 203, false, null),

  -- BOWLS
  ('a0000004-0004-0004-0004-000000000001', 'chicken-biryani-bowl', 'Chicken Biryani Bowl', 'bowls', 1500, 'live', 50, 'Fragrant basmati rice layered with spiced chicken, raita on the side.', null, 300, false, null),
  ('a0000004-0004-0004-0004-000000000002', 'lamb-biryani-bowl', 'Lamb Biryani Bowl', 'bowls', 1700, 'live', 40, 'Slow-cooked lamb biryani with caramelized onions and boiled egg.', null, 301, false, null),
  ('a0000004-0004-0004-0004-000000000003', 'nihari-bowl', 'Nihari Bowl', 'bowls', 1700, 'live', 40, 'Braised beef nihari over rice with fresh ginger, cilantro, and naan chips.', null, 302, false, null),
  ('a0000004-0004-0004-0004-000000000004', 'haleem-bowl', 'Haleem Bowl', 'bowls', 1500, 'live', 40, 'Hearty slow-cooked wheat and meat stew with crispy onions and lemon.', null, 303, false, null),
  ('a0000004-0004-0004-0004-000000000005', 'chicken-karahi-bowl', 'Chicken Karahi Bowl', 'bowls', 1600, 'live', 50, 'Wok-tossed karahi chicken with tomatoes and green chilies over rice.', null, 304, false, null),

  -- PLATES
  ('a0000005-0005-0005-0005-000000000001', 'seekh-kebab-plate', 'Seekh Kebab Plate', 'plates', 1800, 'live', 40, 'Two beef seekh kebabs with basmati rice, salad, and naan.', null, 400, false, null),
  ('a0000005-0005-0005-0005-000000000002', 'chicken-tikka-plate', 'Chicken Tikka Plate', 'plates', 1800, 'live', 40, 'Charcoal-grilled tikka with rice, chutney trio, and fresh naan.', null, 401, false, null),
  ('a0000005-0005-0005-0005-000000000003', 'lamb-chops-plate', 'Lamb Chops Plate', 'plates', 2600, 'live', 25, 'Four tandoori lamb chops with rice, grilled veggies, and raita.', null, 402, false, null),
  ('a0000005-0005-0005-0005-000000000004', 'mixed-grill-plate', 'Mixed Grill Plate', 'plates', 2800, 'live', 25, 'Seekh, tikka, boti, and chapli kebab with rice and naan.', null, 403, false, null),
  ('a0000005-0005-0005-0005-000000000005', 'chapli-kebab-plate', 'Chapli Kebab Plate', 'plates', 1700, 'live', 40, 'Two Peshawari chapli kebabs with salad, rice, and green chutney.', null, 404, false, null),

  -- WINGS
  ('a0000006-0006-0006-0006-000000000001', 'karachi-hot-wings-6', 'Karachi Hot Wings (6pc)', 'wings', 1300, 'live', 60, 'Bold Karachi-style masala heat with a crispy finish.', null, 500, false, null),
  ('a0000006-0006-0006-0006-000000000002', 'karachi-hot-wings-12', 'Karachi Hot Wings (12pc)', 'wings', 2300, 'live', 60, 'Bold Karachi-style masala heat with a crispy finish.', null, 501, false, null),
  ('a0000006-0006-0006-0006-000000000003', 'honey-garlic-lahori-wings-6', 'Honey Garlic Lahori Wings (6pc)', 'wings', 1300, 'live', 60, 'Sweet heat with a Lahori garlic kick.', null, 502, false, null),
  ('a0000006-0006-0006-0006-000000000004', 'honey-garlic-lahori-wings-12', 'Honey Garlic Lahori Wings (12pc)', 'wings', 2300, 'live', 60, 'Sweet heat with a Lahori garlic kick.', null, 503, false, null),

  -- SIDES & CHAAT
  ('a0000007-0007-0007-0007-000000000001', 'samosa-2pc', 'Samosa (2pc)', 'sides', 600, 'live', 80, 'Crispy pastry stuffed with spiced potatoes and peas.', null, 600, false, null),
  ('a0000007-0007-0007-0007-000000000002', 'pakora', 'Pakora', 'sides', 700, 'live', 80, 'Crunchy vegetable fritters with tamarind dip.', null, 601, false, null),
  ('a0000007-0007-0007-0007-000000000003', 'chana-chaat', 'Chana Chaat', 'sides', 800, 'live', 60, 'Tangy chickpea salad with onions, tomatoes, and chaat masala.', null, 602, false, null),
  ('a0000007-0007-0007-0007-000000000004', 'dahi-bhalla', 'Dahi Bhalla', 'sides', 800, 'live', 60, 'Lentil dumplings in cool yogurt with sweet and tangy chutneys.', null, 603, false, null),
  ('a0000007-0007-0007-0007-000000000005', 'fries', 'Fries', 'sides', 500, 'live', 100, 'Crispy seasoned fries with chaat masala.', null, 604, false, null),
  ('a0000007-0007-0007-0007-000000000006', 'naan', 'Naan', 'sides', 400, 'live', 100, 'Fresh-baked tandoori naan.', null, 605, false, null),
  ('a0000007-0007-0007-0007-000000000007', 'paratha', 'Paratha', 'sides', 500, 'live', 100, 'Flaky layered paratha, perfect for rolls or plates.', null, 606, false, null),
  ('a0000007-0007-0007-0007-000000000008', 'raita', 'Raita', 'sides', 400, 'live', 100, 'Cool cucumber-mint yogurt.', null, 607, false, null),
  ('a0000007-0007-0007-0007-000000000009', 'green-chutney', 'Green Chutney', 'sides', 300, 'live', 100, 'House-made cilantro and mint chutney.', null, 608, false, null),

  -- DRINKS
  ('a0000008-0008-0008-0008-000000000001', 'mango-lassi', 'Mango Lassi', 'drinks', 500, 'live', 60, 'Creamy mango yogurt smoothie.', null, 700, false, null),
  ('a0000008-0008-0008-0008-000000000002', 'salted-lassi', 'Salted Lassi', 'drinks', 400, 'live', 60, 'Traditional savory yogurt drink with cumin.', null, 701, false, null),
  ('a0000008-0008-0008-0008-000000000003', 'rooh-afza', 'Rooh Afza', 'drinks', 400, 'live', 80, 'Classic rose-flavored refresher.', null, 702, false, null),
  ('a0000008-0008-0008-0008-000000000004', 'kashmiri-chai', 'Kashmiri Chai', 'drinks', 500, 'live', 60, 'Pink tea with cardamom and crushed almonds.', null, 703, false, null),

  -- SAUCES (1 free, additional \$0.50)
  ('a0000009-0009-0009-0009-000000000001', 'extra-green-chutney', 'Extra Green Chutney', 'sauces', 50, 'live', 200, 'Additional cilantro-mint chutney.', null, 800, false, '1 sauce free with order.'),
  ('a0000009-0009-0009-0009-000000000002', 'extra-tamarind-chutney', 'Extra Tamarind Chutney', 'sauces', 50, 'live', 200, 'Additional sweet and tangy imli chutney.', null, 801, false, null),
  ('a0000009-0009-0009-0009-000000000003', 'extra-raita', 'Extra Raita', 'sauces', 50, 'live', 200, 'Additional cucumber-mint yogurt.', null, 802, false, null),
  ('a0000009-0009-0009-0009-000000000004', 'extra-garlic-toum', 'Extra Garlic Toum', 'sauces', 50, 'live', 200, 'Additional garlic sauce.', null, 803, false, null),
  ('a0000009-0009-0009-0009-000000000005', 'extra-hot-sauce', 'Extra Hot Sauce', 'sauces', 50, 'live', 200, 'Additional house hot sauce.', null, 804, false, null),

  -- ADD-ONS (for rolls/sandwiches)
  ('a0000010-0010-0010-0010-000000000001', 'add-cheese', 'Add Cheese', 'addons', 100, 'live', 200, 'Melted cheese on your roll or sandwich.', null, 900, false, null),
  ('a0000010-0010-0010-0010-000000000002', 'add-fried-egg', 'Add Fried Egg', 'addons', 200, 'live', 200, 'Fried egg added to your order.', null, 901, false, null),
  ('a0000010-0010-0010-0010-000000000003', 'add-extra-protein', 'Add Extra Protein', 'addons', 400, 'live', 100, 'Double the meat in your roll or bowl.', null, 902, false, null)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  price_cents = excluded.price_cents,
  availability = excluded.availability,
  allocation_limit = excluded.allocation_limit,
  description = excluded.description,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  notes = excluded.notes;

-- Delete old menu items not in the new menu
delete from menu_items where id not like 'a0000%';

insert into inventory_items (id, name, unit, on_hand_qty, par_level, status, location, reorder_threshold, notes)
values
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Beef Nihari', 'portions', 18, 10, 'healthy', 'hot line', 8, 'Anchor item for featured menu demand.'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Lamb', 'portions', 11, 8, 'watch', 'prep cooler', 6, 'Enough for current cycle, but not much slack.'),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Chicken', 'portions', 26, 12, 'healthy', 'prep cooler', 10, 'Stable coverage across bowls and rolls.'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Red Pickled Onions', 'trays', 2, 3, 'low', 'garnish station', 3, 'Likely to bottleneck bowl and roll finish.'),
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'Cilantro', 'trays', 1, 2, 'low', 'garnish station', 2, 'Restock before the next pickup rush.'),
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

insert into orders (id, order_number, customer_id, customer_name, customer_email, status, drop_day, service_date, fulfillment_method, delivery_window, zone, total_cents, custom_request, delivery_notes, payment_provider, payment_status)
values
  ('c1111111-1111-1111-1111-111111111111', 'MG-1051', '11111111-1111-1111-1111-111111111111', 'Ayesha Khan', 'ayesha@example.com', 'Ready', 'Wednesday', '2026-03-17', 'pickup', 'Pickup details confirmed after checkout', 'Pickup', 5512, 'No utensils please. Call on arrival.', 'Text when ready for pickup.', 'Stripe', 'paid'),
  ('c2222222-2222-2222-2222-222222222222', 'MG-1052', '22222222-2222-2222-2222-222222222222', 'Hamza Ali', 'hamza@example.com', 'In Prep', 'Wednesday', '2026-03-17', 'pickup', 'Pickup details confirmed after checkout', 'Pickup', 3120, 'Please text instead of calling.', 'Front entrance handoff preferred.', 'Stripe', 'paid'),
  ('c3333333-3333-3333-3333-333333333333', 'MG-1053', '33333333-3333-3333-3333-333333333333', 'Fatima Noor', 'fatima@example.com', 'Picked Up', 'Friday', '2026-03-14', 'pickup', 'Pickup details confirmed after checkout', 'Pickup', 1456, 'Leave at the front desk.', 'Completed pickup.', 'Stripe', 'paid'),
  ('c4444444-4444-4444-4444-444444444444', 'MG-1054', '44444444-4444-4444-4444-444444444444', 'Omar Siddiqui', 'omar@example.com', 'New', 'Friday', '2026-03-14', 'pickup', 'Pickup details confirmed after checkout', 'Pickup', 3744, 'Ring the bell once.', 'Customer requested mild spice on the roll.', 'Stripe', 'paid')
on conflict (id) do nothing;

insert into order_items (order_id, menu_item_id, name, quantity, unit_price_cents, customizations, notes)
values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Nihari Tacos', 2, 1800, '["extra green chutney"]'::jsonb, 'Signature item'),
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaad-aaaa-aaaa-aaaa-aaaaaaaaaaad', 'Lamb Bowl', 1, 1700, '["cilantro","cheese","no onions"]'::jsonb, 'Bowl customization'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Karachi Hot Wings (6pc)', 1, 1500, '["extra ranch"]'::jsonb, 'Sauce on the side'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaae-aaaa-aaaa-aaaa-aaaaaaaaaaae', 'Chicken Bowl', 1, 1500, '["light rice","extra cucumbers"]'::jsonb, 'Medium bowl'),
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'Bihari Roll', 1, 1400, '["normal spice"]'::jsonb, 'Pickup completed'),
  ('c4444444-4444-4444-4444-444444444444', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Lamb Sliders', 2, 1800, '["one no onions"]'::jsonb, 'Office order')
on conflict do nothing;

insert into insights (id, type, title, summary, confidence, action_text, source, is_active)
values
  ('d1111111-1111-1111-1111-111111111111', 'prep', 'Increase lamb prep', 'Bowl conversions are up and lamb remains a high-value item for the current menu.', 94, 'Shift one tray of garnish support toward bowl assembly.', 'sales trend', true),
  ('d2222222-2222-2222-2222-222222222222', 'demand', 'Wings plus one bowl is rising', 'Herndon and Sterling orders are clustering around wings plus a bowl. Combo testing makes sense.', 87, 'Try a limited combo CTA in the next campaign.', 'order mix', true),
  ('d3333333-3333-3333-3333-333333333333', 'ops', 'Red onions and cilantro are the bottleneck', 'The garnish line is the first place service could slow if order pace holds.', 92, 'Prep onions tonight and restock cilantro before the next service block starts.', 'inventory', true),
  ('d4444444-4444-4444-4444-444444444444', 'content', 'Real halal, tight menu, no shortcuts', 'The cleanest message this week still matches the founder-led brand and premium trust angle.', 89, 'Push this into the next menu post and the voice AI greeting.', 'brand strategy', true)
on conflict (id) do nothing;
