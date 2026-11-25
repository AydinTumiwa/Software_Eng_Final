import { CalendarDays } from 'lucide-react';
import { formatDate, parseISODate, toISODate } from '@shared/dates';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// A button that opens a calendar: click the start date, then the end date.
export function DateRangeField({
  start,
  end,
  onChange,
  id,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  id?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="w-full justify-start font-normal">
          <CalendarDays className="mr-2 h-4 w-4" />
          {start ? `${formatDate(start)} – ${end ? formatDate(end) : '…'}` : 'Pick dates'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={start ? parseISODate(start) : undefined}
          selected={{ from: start ? parseISODate(start) : undefined, to: end ? parseISODate(end) : undefined }}
          onSelect={(r) => onChange(r?.from ? toISODate(r.from) : '', r?.to ? toISODate(r.to) : '')}
        />
      </PopoverContent>
    </Popover>
  );
}
