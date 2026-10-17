import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { BattleError, controlBattle, type ControlOp } from '@/server/battles/service';
import { battleView } from '@/server/battles/views';

type Ctx = { params: Promise<{ id: string }> };

const OPS: readonly ControlOp[] = ['start', 'pause', 'resume', 'restart', 'end', 'cancel'];

/** Host controls: `{ op: 'start' | 'pause' | 'resume' | 'restart' | 'end' | 'cancel' }`. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me, body) => {
    const op = body.op as ControlOp;
    if (!OPS.includes(op)) throw new BattleError('Unknown control');
    return battleView(await controlBattle(id, me, op), me._id);
  });
}
