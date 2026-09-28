-- Accounts created before the on_auth_user_created trigger existed have no
-- profile row at all, so "complete your profile" had nothing to UPDATE and
-- would silently no-op, trapping those users on the setup screen forever.
-- Allowing them to insert their own row lets the client upsert instead.

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
