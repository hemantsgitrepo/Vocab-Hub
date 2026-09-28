// ---------------------------------------------------------------------------
// delete-account — permanently deletes the calling user's account and profile
// data. Runs server-side (Deno) because deleting an auth user requires the
// service_role key, which must never exist inside the mobile app bundle.
//
// The app calls this via `supabase.functions.invoke('delete-account')`, which
// attaches the caller's own session JWT automatically. This function re-reads
// that JWT itself (rather than trusting any user id the client might send) so
// a caller can only ever delete their own account, never someone else's.
//
// Required secrets (already set for this project via `supabase secrets set`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server is not configured for account deletion.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // A client scoped to the caller's own JWT — used only to find out who is
    // asking, never to perform the deletion itself.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Not signed in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    // A separate admin client for the actual deletion — kept apart from the
    // caller-scoped one above so it's obvious which calls are privileged.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Profile row first: if this fails, the auth user still exists and the
    // person can be told to retry, rather than being left with an orphaned
    // profile after their login is already gone.
    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.error('delete-account: profile delete failed', profileError);
      return new Response(JSON.stringify({ error: 'Could not delete profile data.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('delete-account: auth delete failed', authDeleteError);
      return new Response(JSON.stringify({ error: 'Could not delete the account.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`delete-account: removed user ${userId}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account failed:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
