import { notifyUser } from './platform';
import { getSettings } from './storage';

// Completion notification for important events only (PRD §54).
// Respects the user's notification setting; silent otherwise.
export async function notifyComplete(message: string): Promise<void> {
  await notifyUser(message, async () => (await getSettings()).notifications);
}
