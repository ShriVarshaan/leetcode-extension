-- Lets a user delete their account. Every user table references auth.users with
-- on delete cascade, so this removes all of their data too.
-- security definer: runs with the owner's rights, because users can't delete from auth.users
-- themselves. It only ever touches the caller's own row.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
