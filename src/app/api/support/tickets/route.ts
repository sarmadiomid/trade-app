import type { NextRequest } from 'next/server';
import { createTicket, listTickets, rawSupportFiles } from '@/server/support';
import { withSupport } from '@/server/support-http';

/** The signed-in user's tickets, newest activity first. */
export async function GET(req: NextRequest) {
  return withSupport(req, async (user) => {
    const tickets = await listTickets(user._id);
    return { tickets, unread: tickets.reduce((sum, ticket) => sum + ticket.unread, 0) };
  });
}

/** Opens a ticket. Body: `{ subject, title?, symbol?, body }`. */
export async function POST(req: NextRequest) {
  return withSupport(req, (user, body) =>
    createTicket(user, {
      subject: body.subject,
      title: body.title,
      symbol: body.symbol,
      body: body.body,
      files: rawSupportFiles(body),
    }),
  );
}
