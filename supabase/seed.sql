-- Reference seed data. Contains no real player statistics.
insert into public.brands (id, name, tagline, series_title, daily_quota, theme, style_guide) values
  ('tiresias', 'Tiresias', 'SEE WHAT THE BOX SCORE CAN’T.', 'COURT VISION', 5,
   '{"bg":"#05070A","ink":"#F3F1EC","accent":"#5BE7C4","options":{"A":"#4CC9F0","B":"#FFB547","C":"#F15BB5","D":"#A3E635"},"display":"Inter Tight"}',
   '{"voice":["intelligent","premium","analytical","confident"],"never":["claim a read was optimal without evidence","invent player positions","state unverified statistics"]}'),
  ('antitiresias', 'AntiTiresias', 'SEE ABSOLUTELY NOTHING.', 'NEGATIVE COURT VISION', 3,
   '{"bg":"#0B0704","ink":"#FFF6E5","accent":"#FFD400","danger":"#FF3B1F","options":{"A":"#38BDF8","B":"#4ADE80","C":"#FF3B1F","D":"#E879F9"},"display":"Anton"}',
   '{"voice":["sarcastic","absurd","self-aware","fast"],"never":["personal attacks","claims about a player beyond the decision on screen","labelling an unlucky outcome a bad read"]}')
on conflict (id) do nothing;

insert into public.app_settings (id) values (true) on conflict (id) do nothing;
