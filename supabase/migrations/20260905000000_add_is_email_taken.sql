-- Mirror of is_mobile_taken, for the sign-up form: lets the client tell a
-- brand-new email from one that already has an account BEFORE sending an
-- OTP, so an existing user is pointed at "sign in" instead of silently
-- being logged into their old account through the sign-up flow.

create or replace function public.is_email_taken(p_email text)
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where lower(email) = lower(trim(p_email))
  );
$$ language sql security definer stable set search_path = public;

grant execute on function public.is_email_taken(text) to anon, authenticated;
