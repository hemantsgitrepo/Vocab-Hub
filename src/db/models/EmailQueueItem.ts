import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export type EmailQueueStatus = 'pending' | 'sent' | 'failed';

// Class/interface declaration merging — see Word.ts for why: types the
// decorator-backed instance properties without emitting class fields.
interface EmailQueueItem {
  toEmail: string;
  subject: string;
  html: string;
  /** Free-form label used only for the app's own debugging, e.g. "welcome". */
  emailType: string;
  status: EmailQueueStatus;
  attempts: number;
  lastError: string | null;
  readonly createdAt: Date;
  sentAt: Date | null;
}

class EmailQueueItem extends Model {
  static table = 'email_queue';
}

export default EmailQueueItem;

// Babel's decorator transform conflicts with babel-preset-expo (SDK 57), so
// WatermelonDB's legacy decorators are applied manually instead of via @syntax
// — matches the pattern in Word.ts.
type LegacyDecorator = (
  target: unknown,
  key: string,
  desc: PropertyDescriptor
) => PropertyDescriptor;

function applyDecorators(key: string, ...decorators: LegacyDecorator[]) {
  let desc: PropertyDescriptor = {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: null,
  } as PropertyDescriptor;
  for (const dec of [...decorators].reverse()) {
    desc = dec(EmailQueueItem.prototype, key, desc) ?? desc;
  }
  delete (desc as { initializer?: unknown }).initializer;
  if (desc.get || desc.set) delete desc.writable;
  Object.defineProperty(EmailQueueItem.prototype, key, desc);
}

applyDecorators('toEmail', text('to_email') as unknown as LegacyDecorator);
applyDecorators('subject', text('subject') as unknown as LegacyDecorator);
applyDecorators('html', text('html') as unknown as LegacyDecorator);
applyDecorators('emailType', text('email_type') as unknown as LegacyDecorator);
applyDecorators('status', text('status') as unknown as LegacyDecorator);
applyDecorators('attempts', field('attempts') as unknown as LegacyDecorator);
applyDecorators('lastError', text('last_error') as unknown as LegacyDecorator);
applyDecorators(
  'createdAt',
  readonly as unknown as LegacyDecorator,
  date('created_at') as unknown as LegacyDecorator
);
applyDecorators('sentAt', date('sent_at') as unknown as LegacyDecorator);
