-- Removes the synthetic demo companies and their demo user accounts.
delete from public.organizations where name in ('Lone Star Distribution (Demo)', 'Gulf Freight Partners (Demo)');
delete from auth.users where email in ('dana.owner@example.com', 'marcus.manager@example.com', 'priya.supervisor@example.com',
                                       'tom.operator@example.com', 'luis.operator@example.com', 'grace.viewer@example.com',
                                       'rosa.owner@example.com');
