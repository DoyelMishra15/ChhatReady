import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { toast } from '../lib/toast';

export function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { toast('error', 'Could not copy.'); }
    }}>
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {done ? 'Copied' : 'Copy'}
    </Button>
  );
}
