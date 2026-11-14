-- Picks' reasons no longer start with the topic (it can be hidden until solved).
-- Strip "<topic> · " from reasons saved before that change.
set client_encoding = 'UTF8';

update public.daily_recs d
set picks = (
  select jsonb_agg(
    case when starts_with(p->>'reason', (p->>'topic') || ' · ')
      then jsonb_set(p, '{reason}', to_jsonb(substr(p->>'reason', length(p->>'topic') + 4)))
      else p
    end
    order by ord)
  from jsonb_array_elements(d.picks) with ordinality as t(p, ord)
)
where jsonb_array_length(d.picks) > 0;
