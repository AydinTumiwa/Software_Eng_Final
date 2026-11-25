// AI assistant for the Forgot password page, using the Claude API.
//
// It can only talk. It cannot see accounts, passwords or emails, and it
// cannot reset anything itself: when someone wants a reset link, it returns
// offerResetLink, and the page shows a button that the person must click to
// request the normal emailed link (which only goes to the address on file).

import Anthropic from '@anthropic-ai/sdk';
import { APP_NAME, ORGANIZATION, PASSWORD_RESET, PASSWORD_RULES } from '../../shared/config';
import type { PasswordHelpMessage, PasswordHelpReply } from '../../shared/types';
import { env } from '../env';
import { HttpError, badRequest } from '../http';

const client = env.aiHelp.enabled ? new Anthropic() : null;

const SYSTEM = `You are the password help assistant on the sign-in pages of ${APP_NAME}, the ${ORGANIZATION} AI Lab virtual machine booking website. Help students and staff who forgot their password or cannot sign in.

How sign-in works on this website:
- Accounts are created by the administrator. New accounts get a temporary password by email and must choose a new password at their first sign-in.
- Forgot password: the person enters their account email and receives a one-time reset link. The link works once and expires after ${PASSWORD_RESET.linkValidMinutes} minutes. It is only sent if an account exists for that email, and the page shows the same message either way.
- If the email doesn't arrive: wait a few minutes, check the spam or junk folder, and make sure it is the university email the administrator registered. A new link replaces any older one.
- New passwords need at least ${PASSWORD_RULES.minLength} characters, including a letter and a number.
- If the person no longer has access to their email, or the link keeps failing, they should contact the administrator or the AI Lab assistant, who can reset the password from the Users page.

Your limits:
- You cannot see accounts, passwords or emails, and you cannot reset a password or sign anyone in. Never claim that you did.
- Never ask for a password. If someone writes one, tell them not to share passwords and to choose a new one.
- Only help with signing in to this website. For anything else, say briefly that you can only help with sign-in problems.

Output: reply in the language the person writes in, in at most 4 short sentences of plain text. Set offer_reset_link to true only when the person wants a reset link and has given the email address it should go to; put that address in email. Otherwise set offer_reset_link to false and email to an empty string.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    offer_reset_link: { type: 'boolean' },
    email: { type: 'string' },
  },
  required: ['reply', 'offer_reset_link', 'email'],
  additionalProperties: false,
};

const MAX_TURNS = 12;
const MAX_CHARS = 1000;
const FALLBACK_REPLY =
  'Sorry, I could not answer that. You can use the form on this page to get a reset link, or contact the administrator or the AI Lab assistant.';

function parseConversation(body: unknown): Anthropic.Beta.BetaMessageParam[] {
  const list = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(list) || list.length === 0) throw badRequest('Send at least one message.');
  const messages = list.slice(-MAX_TURNS).map((m: PasswordHelpMessage) => {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      throw badRequest('Each message needs a role and some text.');
    }
    return { role: m.role, content: m.content.slice(0, MAX_CHARS) };
  });
  // The conversation must start and end with the person's message.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw badRequest('The last message must be yours.');
  return messages;
}

export async function passwordHelp(body: unknown): Promise<PasswordHelpReply> {
  if (!client) throw new HttpError(503, 'The AI assistant is not set up on this server.');
  const messages = parseConversation(body);

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: env.aiHelp.model,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new HttpError(503, 'The AI assistant is busy. Please try again in a minute.');
    if (error instanceof Anthropic.APIError) {
      console.error(`AI password help failed (${error.status}):`, error.message);
      throw new HttpError(502, 'The AI assistant is not available right now. Please use the form instead.');
    }
    throw error;
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    return { reply: FALLBACK_REPLY, offerResetLink: false, email: null };
  }
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(text) as { reply: string; offer_reset_link: boolean; email: string };
    const email = parsed.email.trim();
    return {
      reply: parsed.reply.trim() || FALLBACK_REPLY,
      offerResetLink: parsed.offer_reset_link && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      email: email || null,
    };
  } catch {
    return { reply: FALLBACK_REPLY, offerResetLink: false, email: null };
  }
}
