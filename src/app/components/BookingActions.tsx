import { useState } from 'react';
import { toast } from 'sonner';
import { BOOKING_ACTIONS, type BookingAction } from '@shared/config';
import type { Booking } from '@shared/types';
import { api } from '../api/client';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

const VARIANTS: Partial<Record<BookingAction, 'default' | 'outline' | 'destructive'>> = {
  markReady: 'default',
  startConfiguring: 'default',
  completePurge: 'default',
  reject: 'destructive',
  cancel: 'outline',
};

// Buttons for the status changes the signed-in user may make on a booking.
// The server decides which ones are allowed (booking.actions).
export function BookingActions({
  booking,
  onChanged,
  size = 'sm',
}: {
  booking: Booking;
  onChanged: (b: Booking) => void;
  size?: 'sm' | 'default';
}) {
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [confirming, setConfirming] = useState<BookingAction | null>(null);
  const [note, setNote] = useState('');

  const actions = booking.actions ?? [];
  if (!actions.length) return null;

  const run = async (action: BookingAction, actionNote?: string) => {
    setPending(action);
    try {
      const updated = await api.bookings.act(booking.id, action, actionNote);
      toast.success(`${BOOKING_ACTIONS[action].label}: booking #${booking.id}`);
      setConfirming(null);
      setNote('');
      onChanged(updated);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const needsDialog = (a: BookingAction) => BOOKING_ACTIONS[a].requiresNote || a === 'cancel';
  const dialogAction = confirming ? BOOKING_ACTIONS[confirming] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            size={size}
            variant={VARIANTS[a] ?? 'outline'}
            disabled={pending !== null}
            onClick={() => (needsDialog(a) ? setConfirming(a) : run(a))}
          >
            {pending === a ? 'Saving…' : BOOKING_ACTIONS[a].label}
          </Button>
        ))}
      </div>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction?.label} booking #{booking.id}?
            </DialogTitle>
            <DialogDescription>
              {confirming === 'cancel'
                ? 'The virtual machine will be released and the lab assistant will be told.'
                : 'The person who made the booking will be emailed this reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="action-note">{dialogAction?.requiresNote ? 'Reason' : 'Note (optional)'}</Label>
            <Textarea id="action-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Keep booking
            </Button>
            <Button
              variant={confirming === 'reject' ? 'destructive' : 'default'}
              disabled={pending !== null || (!!dialogAction?.requiresNote && !note.trim())}
              onClick={() => confirming && run(confirming, note.trim() || undefined)}
            >
              {dialogAction?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
