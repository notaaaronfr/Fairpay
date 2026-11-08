/**
 * PayPal sends the client back here after approving (or cancelling) the hold.
 * The order id must be the one this contract started; then it is authorized:
 * the money is held, not taken.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '../../../../lib/db.ts';
import { confirmFunding, cancelFunding } from '../../../../lib/escrow.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  let to: string;
  if (q.get('cancel')) {
    cancelFunding(db(), id);
    to = `/c/${id}?error=${encodeURIComponent('Funding was cancelled in PayPal, so nothing is held.')}`;
  } else {
    try {
      await confirmFunding(db(), id, q.get('token') ?? '');
      to = `/c/${id}?done=${encodeURIComponent('Funded. The money is held in PayPal — the freelancer can start with a guarantee they will be paid.')}`;
    } catch (e) {
      to = `/c/${id}?error=${encodeURIComponent((e as Error).message)}`;
    }
  }
  revalidatePath(`/c/${id}`);
  redirect(to as any);
}
