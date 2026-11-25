import { useEffect, useRef, useState } from 'react';
import { Bot, Mail, Send } from 'lucide-react';
import type { PasswordHelpMessage } from '@shared/types';
import { api } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ChatEntry extends PasswordHelpMessage {
  offerEmail?: string;
}

const GREETING =
  "Hi! I can help if you forgot your password or can't sign in. Tell me what happened, or give me your university email and I can send you a reset link.";

// AI assistant on the Forgot password page. It only talks; sending the reset
// link always needs the person to click the button it offers.
export function PasswordHelpChat({ onSendLink }: { onSendLink: (email: string) => Promise<void> }) {
  const [entries, setEntries] = useState<ChatEntry[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [entries, busy]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatEntry[] = [...entries, { role: 'user', content: text }];
    setEntries(next);
    setInput('');
    setBusy(true);
    try {
      // The greeting is shown locally only; the conversation sent starts with the person.
      const history = next.slice(1).map(({ role, content }) => ({ role, content }));
      const reply = await api.auth.passwordHelp(history);
      setEntries([...next, { role: 'assistant', content: reply.reply, offerEmail: reply.offerResetLink && reply.email ? reply.email : undefined }]);
    } catch (err) {
      setEntries([...next, { role: 'assistant', content: (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async (email: string) => {
    setBusy(true);
    try {
      await onSendLink(email);
      setSentTo(email);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium text-sm">Password help assistant</p>
          <p className="text-xs text-muted-foreground">AI. It can't see your account or password, and can make mistakes.</p>
        </div>
      </div>
      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {entries.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.offerEmail && (
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={busy || sentTo === m.offerEmail}
                  onClick={() => sendLink(m.offerEmail!)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sentTo === m.offerEmail ? 'Link requested' : `Send reset link to ${m.offerEmail}`}
                </Button>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground">Typing…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          maxLength={1000}
          placeholder="e.g. I forgot my password and the email didn't arrive"
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          aria-label="Message to the password help assistant"
        />
        <Button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
