-- Synthetic demo data for STAGING / DEMOS ONLY. Never run against production.
--
-- Creates a fictional company "Lone Star Distribution (Demo)" with six demo users,
-- three facilities, six suppliers and ~48 receiving exceptions spread over 90 days,
-- with assignments, comments, resolution notes and history. All names are fictional;
-- every email address uses example.com, a domain reserved so mail can never be delivered.
--
-- The demo password is NOT stored in this file. Replace __DEMO_PASSWORD__ before running
-- (scripts/seed-demo.sh does this from the DEMO_PASSWORD environment variable).
-- Safe to re-run: it stops if the demo company already exists.
-- To remove all demo data, run supabase/demo/remove-synthetic-demo-data.sql.
-- Also creates a second fictional company ("Gulf Freight Partners (Demo)") to demonstrate isolation.

do $seed$
declare
  v_password constant text := '__DEMO_PASSWORD__';
  v_org uuid;
  v_users uuid[] := '{}';
  v_fac uuid[] := '{}';
  v_sup uuid[] := '{}';
  v_people constant text[][] := array[
    ['dana.owner@example.com',      'Dana Whitfield',   'owner'],
    ['marcus.manager@example.com',  'Marcus Reyes',     'manager'],
    ['priya.supervisor@example.com','Priya Natarajan',  'supervisor'],
    ['tom.operator@example.com',    'Tom Kowalski',     'operator'],
    ['luis.operator@example.com',   'Luis Ortega',      'operator'],
    ['grace.viewer@example.com',    'Grace Lin',        'viewer']
  ];
  v_suppliers constant text[] := array['Trinity Corrugated', 'Bluebonnet Provisions', 'Redline Fastener Supply',
                                       'Pecos Paper Co.', 'Lakeside Beverage Distributors', 'Caddo Plastics'];
  -- Weighted supplier patterns so the dashboard tells a story:
  -- Trinity → damage, Bluebonnet → shortages, Redline → wrong items.
  v_supplier_bias constant text[] := array['damaged', 'shortage', 'wrong_item', 'shortage', 'overage', 'other'];
  v_skus constant text[] := array['CB-1824', 'BP-0412', 'RF-M8x30', 'PP-LTR20', 'LB-12OZ-CS', 'CP-TOTE-L', 'CB-2436', 'BP-0977'];
  v_items constant text[] := array['18x24 corrugated boxes (bundle of 25)', 'Canned black beans, 24 ct case', 'M8 x 30 hex bolts, box of 500',
                                   'Letter copy paper, 10 ream case', 'Sparkling water 12 oz, 24 ct case', 'Large stacking tote, gray',
                                   '24x36 corrugated boxes (bundle of 20)', 'Pinto beans 25 lb sack'];
  v_type text; v_status text; v_i int; v_s int; v_f int; v_rep uuid; v_asg uuid; v_resolver uuid;
  v_occ timestamptz; v_created timestamptz; v_resolved timestamptz; v_exp numeric; v_rec numeric;
  v_desc text; v_notes text; v_inc uuid; v_age_days numeric; v_uid uuid; v_po int := 41180;
begin
  if v_password = '__DEMO' || '_PASSWORD__' or length(v_password) < 12 then
    raise exception 'Set a demo password (12+ characters) before running this script';
  end if;
  if exists (select 1 from public.organizations where name = 'Lone Star Distribution (Demo)') then
    raise notice 'Demo data already exists; nothing to do.';
    return;
  end if;
  perform setseed(0.4242);

  -- Users (created the way Supabase Auth stores email/password accounts, already confirmed).
  for v_i in 1 .. array_length(v_people, 1) loop
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_people[v_i][1],
            extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_people[v_i][2]),
            now() - interval '95 days', now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_people[v_i][1], 'email_verified', true),
            'email', now(), now() - interval '95 days', now());
    v_users := v_users || v_uid;
  end loop;

  insert into public.organizations (name, created_by, created_at)
  values ('Lone Star Distribution (Demo)', v_users[1], now() - interval '95 days') returning id into v_org;
  for v_i in 1 .. array_length(v_people, 1) loop
    insert into public.memberships (org_id, user_id, role, created_at)
    values (v_org, v_users[v_i], v_people[v_i][3]::public.app_role, now() - interval '94 days');
  end loop;

  insert into public.facilities (org_id, name, code, address) values
    (v_org, 'Dallas DC', 'DAL1', '1200 Example Industrial Blvd, Dallas, TX'),
    (v_org, 'Fort Worth Cross-Dock', 'FTW1', '450 Sample Logistics Pkwy, Fort Worth, TX'),
    (v_org, 'Houston Hub', 'HOU1', '88 Demo Port Rd, Houston, TX');
  select array_agg(id order by code) into v_fac from public.facilities where org_id = v_org; -- DAL1, FTW1, HOU1

  for v_i in 1 .. array_length(v_suppliers, 1) loop
    insert into public.suppliers (org_id, name, created_by) values (v_org, v_suppliers[v_i], v_users[2]) returning id into v_uid;
    v_sup := v_sup || v_uid;
  end loop;

  -- Incidents
  for v_i in 1 .. 48 loop
    v_s := 1 + floor(power(random(), 1.6) * 6)::int;          -- early suppliers appear more often
    v_type := case when random() < 0.6 then v_supplier_bias[v_s]
                   else (array['shortage','overage','damaged','wrong_item','other'])[1 + floor(random() * 5)::int] end;
    v_f := 1 + floor(power(random(), 1.3) * 3)::int;
    v_rep := v_users[(array[3, 4, 4, 5, 5])[1 + floor(random() * 5)::int]];
    v_occ := date_trunc('minute', now() - (power(random(), 1.2) * 88 + 0.05) * interval '1 day');
    v_occ := date_trunc('day', v_occ) + interval '6 hours' + (random() * 11) * interval '1 hour';   -- 6am–5pm shifts
    if v_occ > now() then v_occ := now() - interval '30 minutes'; end if;
    v_created := v_occ + (10 + random() * 80) * interval '1 minute';
    if v_created > now() then v_created := now(); end if;
    v_age_days := extract(epoch from now() - v_occ) / 86400;

    v_exp := null; v_rec := null;
    if v_type in ('shortage', 'overage') or random() < 0.4 then
      v_exp := (array[24, 40, 48, 60, 100, 120, 200, 500])[1 + floor(random() * 8)::int];
      v_rec := case v_type
        when 'shortage' then v_exp - (1 + floor(random() * least(v_exp * 0.25, 30)))
        when 'overage' then v_exp + (1 + floor(random() * least(v_exp * 0.15, 20)))
        else v_exp end;
    end if;

    v_desc := case v_type
      when 'shortage' then format('Counted %s against %s on the ASN. %s cartons missing; seals intact, no visible damage to trailer.', v_rec, v_exp, v_exp - v_rec)
      when 'overage' then format('Received %s, PO calls for %s. Extra %s units staged in the overage cage pending supplier instruction.', v_rec, v_exp, v_rec - v_exp)
      when 'damaged' then (array['Two pallets crushed on the top tier; outer cartons torn and product exposed.',
                                 'Forklift tine punctures on three cartons. Product inside dented.',
                                 'Shrink wrap failed in transit; cases shifted and several split open.',
                                 'Water damage on the bottom layer — cartons soft, product labels unreadable.'])[1 + floor(random() * 4)::int]
      when 'wrong_item' then (array['Received the wrong size: labels show a different SKU than the PO line.',
                                    'Case labels match the PO but contents are a different item.',
                                    'Wrong color variant shipped for the entire line.'])[1 + floor(random() * 3)::int]
      else (array['ASN arrived after the trailer; reference numbers do not match the BOL.',
                  'Pallet labels missing; receiving had to identify product by hand.',
                  'Temperature recorder missing on a load that requires one.'])[1 + floor(random() * 3)::int]
    end;

    -- Older incidents are mostly finished; recent ones are still being worked.
    v_status := case
      when v_age_days > 25 then (array['closed', 'closed', 'resolved', 'resolved', 'resolved', 'in_progress'])[1 + floor(random() * 6)::int]
      when v_age_days > 7 then (array['resolved', 'resolved', 'in_progress', 'in_progress', 'open'])[1 + floor(random() * 5)::int]
      else (array['open', 'open', 'in_progress', 'resolved'])[1 + floor(random() * 4)::int] end;
    v_asg := case when v_status = 'open' and random() < 0.5 then null
                  else v_users[(array[3, 4, 5, 2])[1 + floor(random() * 4)::int]] end;
    v_resolver := coalesce(v_asg, v_users[3]);
    v_notes := null; v_resolved := null;
    if v_status in ('resolved', 'closed') then
      v_resolved := v_created + (2 + power(random(), 2) * 140) * interval '1 hour';
      if v_resolved > now() then v_resolved := now() - interval '5 minutes'; end if;
      v_notes := (array['Supplier issued a credit memo for the variance.',
                        'Replacement shipment received and put away.',
                        'Carrier claim filed; supplier confirmed credit pending claim outcome.',
                        'Recount found units mis-slotted; inventory corrected, no supplier action needed.',
                        'Supplier authorized return; product shipped back on the next outbound.',
                        'Accepted as-is at a negotiated discount.'])[1 + floor(random() * 6)::int];
    end if;

    v_po := v_po + 1 + floor(random() * 37)::int;
    insert into public.incidents (org_id, facility_id, type, status, supplier_id, po_number, shipment_ref, sku, item_description,
                                  expected_qty, received_qty, description, occurred_at, reported_by, assigned_to,
                                  resolution_notes, resolved_at, resolved_by, created_at)
    values (v_org, v_fac[v_f], v_type::public.exception_type, v_status::public.incident_status, v_sup[v_s],
            'PO-' || v_po, 'BOL-' || (700000 + floor(random() * 99999)::int), v_skus[1 + floor(random() * 8)::int],
            v_items[1 + floor(random() * 8)::int], v_exp, v_rec, v_desc, v_occ, v_rep, v_asg,
            v_notes, v_resolved, case when v_resolved is not null then v_resolver end, v_created)
    returning id into v_inc;

    -- Make the automatically written history look like it happened over time.
    update public.incident_events set actor_id = v_rep, to_value = 'open', created_at = v_created
      where incident_id = v_inc and event_type = 'created';
    update public.incident_events set actor_id = v_users[3], created_at = v_created + interval '20 minutes'
      where incident_id = v_inc and event_type = 'assigned';
    if v_status <> 'open' then
      insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, to_value, created_at)
      values (v_org, v_inc, coalesce(v_asg, v_users[3]), 'status_changed', 'open', 'in_progress', v_created + interval '45 minutes');
    end if;
    if random() < 0.7 then
      insert into public.incident_comments (org_id, incident_id, author_id, body, created_at)
      values (v_org, v_inc, coalesce(v_asg, v_users[3]),
              (array['Photos taken and sent to the supplier rep.', 'Called the supplier; waiting on a callback.',
                     'Carrier driver signed the BOL with exceptions noted.', 'Product quarantined in aisle Q until resolved.',
                     'Supplier asked for pallet tag photos — uploaded to the shared folder.'])[1 + floor(random() * 5)::int],
              v_created + interval '1 hour');
    end if;
    if v_status in ('resolved', 'closed') then
      insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, to_value, created_at) values
        (v_org, v_inc, v_resolver, 'resolution_notes_updated', null, v_notes, v_resolved - interval '1 minute'),
        (v_org, v_inc, v_resolver, 'status_changed', 'in_progress', 'resolved', v_resolved);
      if v_status = 'closed' then
        insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, to_value, created_at)
        values (v_org, v_inc, v_users[3], 'status_changed', 'resolved', 'closed', v_resolved + interval '1 day');
      end if;
    end if;
  end loop;

  -- Comment events were stamped "now" by the trigger; align them with the comments.
  update public.incident_events e set created_at = c.created_at, actor_id = c.author_id
    from public.incident_comments c
   where e.incident_id = c.incident_id and e.event_type = 'comment_added' and e.org_id = v_org;

  raise notice 'Demo company created with % incidents.', (select count(*) from public.incidents where org_id = v_org);
end
$seed$;

-- A second, separate fictional company, used to demonstrate that companies can't see
-- each other's data (log in as rosa.owner@example.com and nothing from Lone Star appears).
do $second$
declare
  v_password constant text := '__DEMO_PASSWORD__';
  v_uid uuid := gen_random_uuid();
  v_org uuid;
  v_fac uuid;
  v_sup uuid;
begin
  if exists (select 1 from public.organizations where name = 'Gulf Freight Partners (Demo)') then
    return;
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', 'rosa.owner@example.com',
          extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"full_name":"Rosa Delgado"}', now(), now(), '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'rosa.owner@example.com', 'email_verified', true),
          'email', now(), now(), now());
  insert into public.organizations (name, created_by) values ('Gulf Freight Partners (Demo)', v_uid) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.facilities (org_id, name, code) values (v_org, 'Beaumont Terminal', 'BMT1') returning id into v_fac;
  insert into public.suppliers (org_id, name, created_by) values (v_org, 'Sabine Steel Drums', v_uid) returning id into v_sup;
  insert into public.incidents (org_id, facility_id, type, supplier_id, po_number, expected_qty, received_qty, description, occurred_at, reported_by)
  values (v_org, v_fac, 'shortage', v_sup, 'GF-9001', 80, 76, 'Four drums short against the packing list.', now() - interval '3 days', v_uid),
         (v_org, v_fac, 'damaged', v_sup, 'GF-9002', null, null, 'One drum dented at the chime; no leak.', now() - interval '1 day', v_uid);
  update public.incident_events e set actor_id = v_uid where e.org_id = v_org;
end
$second$;
