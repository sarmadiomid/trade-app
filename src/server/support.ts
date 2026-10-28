import 'server-only';
import { ObjectId } from 'mongodb';
import {
  checkSupportFile,
  parseNewTicket,
  parseSupportBody,
  SUPPORT_AGENT_NAME,
  SUPPORT_FILE_MAX_COUNT,
  SUPPORT_MESSAGE_CAP,
  SUPPORT_OPEN_CAP,
  type SupportAttachment,
  type SupportMessage,
  type SupportRole,
  type SupportStatus,
  type SupportTicket,
} from '@/lib/support/catalog';
import { collections, type SupportMessageDoc, type SupportTicketDoc } from './db';

export class SupportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Owner = { readonly _id: ObjectId; readonly name: string };

const PREVIEW_MAX = 140;

function previewOf(body: string): string {
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > PREVIEW_MAX ? `${one.slice(0, PREVIEW_MAX - 1)}…` : one;
}

function toTicket(doc: SupportTicketDoc): SupportTicket {
  return {
    id: doc._id.toHexString(),
    number: doc.number,
    subject: doc.subject,
    title: doc.title,
    symbol: doc.symbol,
    status: doc.status,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
    preview: doc.preview,
    lastRole: doc.lastRole,
    unread: doc.unread,
  };
}

function toMessage(doc: SupportMessageDoc): SupportMessage {
  return {
    id: doc._id.toHexString(),
    role: doc.role,
    name: doc.name,
    body: doc.body,
    createdAt: doc.createdAt.getTime(),
    attachments: doc.attachments ?? [],
  };
}

export interface RawSupportFile {
  readonly name: string;
  readonly type: string;
  readonly data: Buffer;
}

interface PreparedFile {
  readonly name: string;
  readonly type: string;
  readonly image: boolean;
  readonly size: number;
  readonly data: Buffer;
}

/** Pulls uploaded files off a support request body. JSON requests have none. */
export function rawSupportFiles(body: Record<string, unknown>): RawSupportFile[] {
  if (!Array.isArray(body.files)) return [];
  return body.files.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as { name?: unknown; type?: unknown; data?: unknown };
    if (
      typeof row.name !== 'string' ||
      typeof row.type !== 'string' ||
      !Buffer.isBuffer(row.data)
    ) {
      return [];
    }
    return [{ name: row.name, type: row.type, data: row.data }];
  });
}

export function prepareSupportFiles(raw: readonly RawSupportFile[]): PreparedFile[] {
  if (raw.length > SUPPORT_FILE_MAX_COUNT) throw new SupportError('Too many files', 400);
  return raw.map((file) => {
    const checked = checkSupportFile({ name: file.name, type: file.type, size: file.data.length });
    if (!checked.ok) throw new SupportError(checked.error, 400);
    if (!bytesMatch(checked.type, file.data)) throw new SupportError('Invalid file', 400);
    return {
      name: checked.name,
      type: checked.type,
      image: checked.image,
      size: file.data.length,
      data: file.data,
    };
  });
}

function bytesMatch(mime: string, data: Buffer): boolean {
  if (data.length < 12)
    return (
      mime !== 'image/jpeg' &&
      mime !== 'image/png' &&
      mime !== 'image/gif' &&
      mime !== 'image/webp' &&
      mime !== 'application/pdf'
    );
  if (mime === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mime === 'image/png')
    return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  if (mime === 'image/gif') return data.subarray(0, 4).toString('ascii') === 'GIF8';
  if (mime === 'image/webp') {
    return (
      data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') return data.subarray(0, 5).toString('ascii') === '%PDF-';
  return true;
}

function messagePreview(text: string, files: readonly { name: string }[]): string {
  if (text) return previewOf(text);
  return previewOf(files.map((file) => file.name).join('، '));
}

async function storeFiles(
  ticketId: ObjectId,
  messageId: ObjectId,
  userId: ObjectId,
  files: readonly PreparedFile[],
): Promise<SupportAttachment[]> {
  if (files.length === 0) return [];
  const { supportFiles } = await collections();
  const now = new Date();
  const docs = files.map((file) => ({
    _id: new ObjectId(),
    ticketId,
    messageId,
    userId,
    name: file.name,
    type: file.type,
    size: file.size,
    image: file.image,
    data: file.data,
    createdAt: now,
  }));
  await supportFiles.insertMany(docs);
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    name: doc.name,
    type: doc.type,
    size: doc.size,
    image: doc.image,
  }));
}

async function nextNumber(): Promise<number> {
  const { db } = await collections();
  const row = await db
    .collection<{ _id: string; n: number }>('counters')
    .findOneAndUpdate(
      { _id: 'supportTicket' },
      { $inc: { n: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
  if (!row || typeof row.n !== 'number') throw new SupportError('Server error', 500);
  return row.n;
}

async function ownedTicket(userId: ObjectId, id: string): Promise<SupportTicketDoc> {
  if (!ObjectId.isValid(id)) throw new SupportError('Ticket not found', 404);
  const { supportTickets } = await collections();
  const ticket = await supportTickets.findOne({ _id: new ObjectId(id) });
  if (!ticket || !ticket.userId.equals(userId)) throw new SupportError('Ticket not found', 404);
  return ticket;
}

export async function unreadCount(userId: ObjectId): Promise<number> {
  const { supportTickets } = await collections();
  const rows = await supportTickets
    .find({ userId, unread: { $gt: 0 } }, { projection: { unread: 1 } })
    .toArray();
  return rows.reduce((sum, row) => sum + row.unread, 0);
}

export async function listTickets(userId: ObjectId): Promise<readonly SupportTicket[]> {
  const { supportTickets } = await collections();
  const rows = await supportTickets.find({ userId }).sort({ updatedAt: -1 }).limit(100).toArray();
  return rows.map(toTicket);
}

export async function createTicket(
  user: Owner,
  input: {
    subject: unknown;
    title: unknown;
    symbol: unknown;
    body: unknown;
    files?: readonly RawSupportFile[];
  },
): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const parsed = parseNewTicket(input);
  if (!parsed.ok) throw new SupportError(parsed.error, 400);
  const prepared = prepareSupportFiles(input.files ?? []);
  const { supportTickets, supportMessages, supportFiles } = await collections();
  const open = await supportTickets.countDocuments({
    userId: user._id,
    status: { $ne: 'closed' },
  });
  if (open >= SUPPORT_OPEN_CAP) throw new SupportError('Too many tickets', 429);
  const now = new Date();
  const ticketId = new ObjectId();
  const messageId = new ObjectId();
  const { subject, title, symbol, body } = parsed.value;
  const attachments = await storeFiles(ticketId, messageId, user._id, prepared);
  const ticket: SupportTicketDoc = {
    _id: ticketId,
    number: await nextNumber(),
    userId: user._id,
    userName: user.name,
    subject,
    title,
    symbol,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    preview: messagePreview(body, attachments),
    lastRole: 'user',
    unread: 0,
  };
  const message: SupportMessageDoc = {
    _id: messageId,
    ticketId,
    userId: user._id,
    role: 'user',
    name: user.name,
    body,
    createdAt: now,
    attachments,
  };
  try {
    await supportTickets.insertOne(ticket);
    await supportMessages.insertOne(message);
  } catch (error) {
    await supportMessages.deleteOne({ _id: messageId });
    await supportTickets.deleteOne({ _id: ticketId });
    if (attachments.length > 0) await supportFiles.deleteMany({ messageId });
    throw error;
  }
  return { ticket: toTicket(ticket), message: toMessage(message) };
}

export async function getThread(
  userId: ObjectId,
  id: string,
): Promise<{
  ticket: SupportTicket;
  messages: readonly SupportMessage[];
  markedRead: boolean;
}> {
  const ticket = await ownedTicket(userId, id);
  const { supportTickets, supportMessages } = await collections();
  let markedRead = false;
  if (ticket.unread > 0) {
    await supportTickets.updateOne({ _id: ticket._id }, { $set: { unread: 0 } });
    ticket.unread = 0;
    markedRead = true;
  }
  const messages = await supportMessages
    .find({ ticketId: ticket._id })
    .sort({ createdAt: 1, _id: 1 })
    .limit(SUPPORT_MESSAGE_CAP)
    .toArray();
  return { ticket: toTicket(ticket), messages: messages.map(toMessage), markedRead };
}

export async function postUserMessage(
  user: Owner,
  id: string,
  body: unknown,
  files: readonly RawSupportFile[] = [],
): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const prepared = prepareSupportFiles(files);
  let text = '';
  if (typeof body === 'string' && body.trim() !== '') {
    const parsed = parseSupportBody(body);
    if (!parsed.ok) throw new SupportError(parsed.error, 400);
    text = parsed.text;
  } else if (prepared.length === 0) {
    throw new SupportError('Message too short', 400);
  }
  const ticket = await ownedTicket(user._id, id);
  const { supportTickets, supportMessages, supportFiles } = await collections();
  const replies = await supportMessages.countDocuments({ ticketId: ticket._id, role: 'support' });
  if (replies === 0) throw new SupportError('Awaiting reply', 409);
  const count = await supportMessages.countDocuments({ ticketId: ticket._id });
  if (count >= SUPPORT_MESSAGE_CAP) throw new SupportError('Too many messages', 429);
  const now = new Date();
  const messageId = new ObjectId();
  const attachments = await storeFiles(ticket._id, messageId, user._id, prepared);
  const message: SupportMessageDoc = {
    _id: messageId,
    ticketId: ticket._id,
    userId: user._id,
    role: 'user',
    name: user.name,
    body: text,
    createdAt: now,
    attachments,
  };
  try {
    await supportMessages.insertOne(message);
  } catch (error) {
    if (attachments.length > 0) await supportFiles.deleteMany({ messageId });
    throw error;
  }
  const updated = await supportTickets.findOneAndUpdate(
    { _id: ticket._id },
    {
      $set: {
        status: 'open' as const,
        updatedAt: now,
        preview: messagePreview(text, attachments),
        lastRole: 'user' as const,
        unread: 0,
        userName: user.name,
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw new SupportError('Ticket not found', 404);
  return { ticket: toTicket(updated), message: toMessage(message) };
}

export async function closeTicket(userId: ObjectId, id: string): Promise<SupportTicket> {
  const ticket = await ownedTicket(userId, id);
  if (ticket.status === 'closed') return toTicket(ticket);
  const { supportTickets } = await collections();
  const now = new Date();
  const updated = await supportTickets.findOneAndUpdate(
    { _id: ticket._id },
    { $set: { status: 'closed' as const, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new SupportError('Ticket not found', 404);
  return toTicket(updated);
}

export async function listStaffTickets(status: SupportStatus | 'all'): Promise<
  Array<SupportTicket & { readonly userName: string; readonly phone: string }>
> {
  const { supportTickets, users } = await collections();
  const filter = status === 'all' ? {} : { status };
  const rows = await supportTickets.find(filter).sort({ updatedAt: -1 }).limit(80).toArray();
  const ids = [...new Map(rows.map((row) => [row.userId.toHexString(), row.userId])).values()];
  const owners = await users.find({ _id: { $in: ids } }, { projection: { phone: 1 } }).toArray();
  const phones = new Map(owners.map((owner) => [owner._id.toHexString(), owner.phone]));
  return rows.map((row) => ({
    ...toTicket(row),
    userName: row.userName,
    phone: phones.get(row.userId.toHexString()) ?? '',
  }));
}

export async function staffThread(id: string): Promise<{
  ticket: SupportTicket & { readonly userName: string; readonly phone: string };
  messages: readonly SupportMessage[];
} | null> {
  if (!ObjectId.isValid(id)) return null;
  const { supportTickets, supportMessages, users } = await collections();
  const ticket = await supportTickets.findOne({ _id: new ObjectId(id) });
  if (!ticket) return null;
  const [messages, owner] = await Promise.all([
    supportMessages.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).toArray(),
    users.findOne({ _id: ticket.userId }, { projection: { phone: 1 } }),
  ]);
  return {
    ticket: { ...toTicket(ticket), userName: ticket.userName, phone: owner?.phone ?? '' },
    messages: messages.map(toMessage),
  };
}

export async function closeTicketAsStaff(id: string): Promise<SupportTicket> {
  if (!ObjectId.isValid(id)) throw new SupportError('Ticket not found', 404);
  const { supportTickets } = await collections();
  const updated = await supportTickets.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status: 'closed' as const, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new SupportError('Ticket not found', 404);
  return toTicket(updated);
}

/**
 * Staff reply. The admin panel will call this; nothing on the public API does.
 * The ticket becomes «answered» and the reply counts as unread for the user.
 */
export async function replyToTicket(
  id: string,
  body: unknown,
  agentName = SUPPORT_AGENT_NAME,
): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const parsed = parseSupportBody(body);
  if (!parsed.ok) throw new SupportError(parsed.error, 400);
  if (!ObjectId.isValid(id)) throw new SupportError('Ticket not found', 404);
  const { supportTickets, supportMessages } = await collections();
  const ticket = await supportTickets.findOne({ _id: new ObjectId(id) });
  if (!ticket) throw new SupportError('Ticket not found', 404);
  const count = await supportMessages.countDocuments({ ticketId: ticket._id });
  if (count >= SUPPORT_MESSAGE_CAP) throw new SupportError('Too many messages', 429);
  const now = new Date();
  const message: SupportMessageDoc = {
    _id: new ObjectId(),
    ticketId: ticket._id,
    userId: ticket.userId,
    role: 'support' satisfies SupportRole,
    name: agentName.trim() || SUPPORT_AGENT_NAME,
    body: parsed.text,
    createdAt: now,
    attachments: [],
  };
  await supportMessages.insertOne(message);
  const updated = await supportTickets.findOneAndUpdate(
    { _id: ticket._id },
    {
      $set: {
        status: 'answered' as const,
        updatedAt: now,
        preview: previewOf(parsed.text),
        lastRole: 'support' as const,
      },
      $inc: { unread: 1 },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw new SupportError('Ticket not found', 404);
  return { ticket: toTicket(updated), message: toMessage(message) };
}

/** A file the signed-in user is allowed to open, because they own its ticket. */
export async function readSupportFile(
  userId: ObjectId,
  id: string,
): Promise<{ name: string; type: string; image: boolean; data: Uint8Array } | null> {
  if (!ObjectId.isValid(id)) return null;
  const { supportFiles, supportTickets } = await collections();
  const file = await supportFiles.findOne({ _id: new ObjectId(id) });
  if (!file) return null;
  const ticket = await supportTickets.findOne(
    { _id: file.ticketId, userId },
    { projection: { _id: 1 } },
  );
  if (!ticket) return null;
  return { name: file.name, type: file.type, image: file.image, data: fileBytes(file.data) };
}

function fileBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'object' && data !== null && 'buffer' in data) {
    const buffer = (data as { buffer?: unknown }).buffer;
    if (buffer instanceof Uint8Array) return buffer;
  }
  return new Uint8Array();
}
