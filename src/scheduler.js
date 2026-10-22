import { randomUUID } from 'node:crypto';
import { TERMINAL } from './tasks.js';

export class Scheduler {
  constructor(crew) {
    this.crew = crew;
  }
  get(id) {
    const job = this.crew.state.schedules.find(s => s.id === id);
    if (!job) throw new Error('Unknown schedule. Use /schedule list.');
    return job;
  }
  add(minutes, member, text, writable = false) {
    this.crew.member(member);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525600)
      throw new Error('Schedule interval must be 1–525600 minutes.');
    if (!text?.trim() || text.length > 8000) throw new Error('Enter a schedule goal of 1–8000 characters.');
    if (this.crew.state.schedules.length >= 50) throw new Error('Maximum 50 schedules.');
    const chat = this.crew.conversations.create(member, `Schedule: ${text.slice(0, 80)}`, { activate: false });
    const job = {
      id: randomUUID().slice(0, 8),
      member,
      text,
      minutes,
      readOnly: !writable,
      enabled: true,
      nextRun: Date.now() + minutes * 60000,
      conversationId: chat.id,
    };
    this.crew.state.schedules.push(job);
    this.crew.save();
    return job;
  }
  setEnabled(id, enabled) {
    const job = this.get(id);
    if (enabled) {
      this.crew.member(job.member);
      if (this.crew.conversations.get(job.conversationId).archived)
        throw new Error('Restore the schedule’s conversation before resuming.');
    }
    job.enabled = enabled;
    this.crew.save();
  }
  tick(now = Date.now(), onlyId = null) {
    this.crew.watch?.tick(now);
    if (this.crew.queue.paused || this.crew.queue.closing) return [];
    const dispatched = [];
    for (const job of this.crew.state.schedules) {
      if (onlyId ? job.id !== onlyId : !job.enabled || job.nextRun > now) continue;
      const prior = job.lastTaskId && this.crew.state.tasks.find(t => t.id === job.lastTaskId);
      if (prior && !TERMINAL.has(prior.status)) continue;
      const id = randomUUID().slice(0, 8);
      // Persist the claim and task together. Missed intervals produce one run.
      const previous = { nextRun: job.nextRun, lastTaskId: job.lastTaskId };
      job.nextRun = now + job.minutes * 60000;
      job.lastTaskId = id;
      try {
        dispatched.push(
          this.crew.queue.enqueue(job.member, job.text, {
            id,
            scheduleId: job.id,
            readOnly: job.readOnly,
            conversationId: job.conversationId,
            hold: true,
          }),
        );
      } catch (error) {
        Object.assign(job, previous);
        throw error;
      }
    }
    this.crew.queue.drain();
    return dispatched;
  }
}

export async function runWorker(crew, { once = false, signal } = {}) {
  // Restored work requires explicit resume; a scheduled worker only runs new jobs.
  if (crew.queue.paused)
    throw new Error(
      'Saved tasks are paused. Inspect them in the interactive app and resume or cancel before starting the worker.',
    );
  do {
    crew.scheduler.tick();
    if (once) {
      while (crew.queue.inflight.size) await Promise.allSettled([...crew.queue.inflight]);
      crew.watch?.tick();
      return;
    }
    await new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, 1000);
      signal?.addEventListener('abort', finish, { once: true });
      if (signal?.aborted) finish();
    });
  } while (!signal?.aborted);
}
