// ---------------------------------------------------------------------------
// send-email — the only place SMTP credentials exist. Runs server-side on
// Supabase's infrastructure (Deno), never inside the mobile app bundle.
//
// The app calls this via `supabase.functions.invoke('send-email', {...})`,
// which automatically attaches the caller's Supabase auth header — Supabase
// verifies that JWT before this code even runs (default behaviour for every
// Edge Function), so only requests carrying a valid project key/session can
// reach it.
//
// Required secrets (set via `supabase secrets set`, never committed):
//   SMTP_HOST      e.g. smtp.hostinger.com
//   SMTP_PORT      e.g. 465
//   SMTP_USER      e.g. noreply@jobmanch.ai
//   SMTP_PASSWORD  the mailbox password (rotate immediately if ever exposed)
//   SMTP_FROM_NAME e.g. Vocab Hub
// ---------------------------------------------------------------------------
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  /** Free-form label for logging only, e.g. "welcome", "milestone", "streak". */
  type?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const host = Deno.env.get('SMTP_HOST');
    const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
    const user = Deno.env.get('SMTP_USER');
    const password = Deno.env.get('SMTP_PASSWORD');
    const fromName = Deno.env.get('SMTP_FROM_NAME') ?? 'Vocab Hub';

    if (!host || !user || !password) {
      return new Response(
        JSON.stringify({ error: 'SMTP secrets are not configured on this function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as SendEmailRequest;
    if (!body.to || !body.subject || !body.html) {
      return new Response(
        JSON.stringify({ error: 'Request must include "to", "subject" and "html".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: true, // port 465 = implicit TLS
        auth: { username: user, password },
      },
    });

    await client.send({
      from: `${fromName} <${user}>`,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });
    await client.close();

    console.log(`Email sent: type=${body.type ?? 'unlabelled'} to=${body.to}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-email failed:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
