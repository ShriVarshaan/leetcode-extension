// Weekly summary email. Called every hour by pg_cron (see migration 0007); sends to opted-in
// users whose local time is Sunday 18:xx, once per week.
// POST {"user_id": "..."} sends to that one user immediately (for testing), ignoring the
// schedule and the opt-in. Both need the x-cron-secret header.
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { buildSummary, isSendTime, renderEmail, weekStart } from './summary.ts';

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

const LIST_NAMES: Record<string, string> = {
  blind75: 'Blind 75',
  neetcode150: 'NeetCode 150',
  striver_a2z: "Striver's A2Z",
};

Deno.serve(async (req) => {
  if (req.method !== 'POST' || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { user_id?: string };

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const port = Number(Deno.env.get('SMTP_PORT') ?? 465);
  const mailer = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });

  let query = supabase.from('user_settings').select('user_id, timezone, lists');
  query = body.user_id ? query.eq('user_id', body.user_id) : query.eq('weekly_email', true);
  const { data: users, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const results: { user_id: string; status: string }[] = [];
  for (const u of users) {
    try {
      if (!body.user_id && !isSendTime(now, u.timezone)) continue;
      const week = weekStart(now, u.timezone);
      if (!body.user_id) {
        const { data: sent } = await supabase
          .from('weekly_email_log')
          .select('user_id')
          .eq('user_id', u.user_id)
          .eq('week_start', week)
          .maybeSingle();
        if (sent) {
          results.push({ user_id: u.user_id, status: 'already sent' });
          continue;
        }
      }

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(u.user_id);
      if (userError || !userData.user.email) throw userError ?? new Error('User has no email');

      const since = new Date(now.getTime() - 400 * 86_400_000).toISOString();
      const [solves, reviews, topics, listProblems, recs] = await Promise.all([
        supabase.from('user_solves').select('slug, first_solved_at, last_solved_at, problems(topic)').eq('user_id', u.user_id),
        supabase.from('user_review_log').select('topic, rating, reviewed_at').eq('user_id', u.user_id).gte('reviewed_at', since),
        supabase.from('user_topic_state').select('topic, ease, due_at').eq('user_id', u.user_id),
        supabase.from('list_problems').select('list_id, slug').in('list_id', u.lists),
        supabase.from('daily_recs').select('date, completed').eq('user_id', u.user_id).gte('date', since.slice(0, 10)),
      ]);
      for (const r of [solves, reviews, topics, listProblems, recs]) if (r.error) throw r.error;

      const solved = new Set(solves.data!.map((s) => s.slug));
      const summary = buildSummary({
        now,
        timeZone: u.timezone,
        solves: solves.data!.map((s) => ({
          slug: s.slug,
          topic: (s.problems as unknown as { topic: string } | null)?.topic ?? '',
          first_solved_at: s.first_solved_at,
          last_solved_at: s.last_solved_at,
        })),
        reviews: reviews.data!,
        topics: topics.data!,
        completedDays: recs.data!.filter((r) => r.completed.length > 0).map((r) => r.date),
        lists: (u.lists as string[]).map((id) => {
          const slugs = listProblems.data!.filter((lp) => lp.list_id === id).map((lp) => lp.slug);
          return { name: LIST_NAMES[id] ?? id, total: slugs.length, solved: slugs.filter((s) => solved.has(s)).length };
        }),
      });
      const email = renderEmail(summary);
      await mailer.sendMail({
        from: Deno.env.get('SMTP_FROM') ?? env('SMTP_USER'),
        to: userData.user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      await supabase.from('weekly_email_log').upsert({ user_id: u.user_id, week_start: week, sent_at: now.toISOString() });
      results.push({ user_id: u.user_id, status: 'sent' });
    } catch (e) {
      console.error('Weekly summary failed for', u.user_id, e);
      results.push({ user_id: u.user_id, status: `error: ${(e as Error).message}` });
    }
  }
  return Response.json({ checked: users.length, results });
});
