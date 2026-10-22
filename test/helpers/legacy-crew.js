import { Crew as CurrentCrew } from '../../src/crew.js';
export { buildArgs, runCodex } from '../../src/crew.js';

// These fixtures exercise compatibility with the original planned workflow
// engine. New default behavior is covered by lead-execution.test.js using the
// real Crew class, including the user-facing /crew-task command.
export class Crew extends CurrentCrew {
  constructor(...args) {
    super(...args);
    const start = this.workflows.start.bind(this.workflows);
    this.workflows.start = (text, options = {}) => start(text, { engine: 'legacy', ...options });
    const enqueue = this.queue.enqueue.bind(this.queue);
    this.queue.enqueue = (member, text, options = {}) => enqueue(member, text, { recoveryMode: 'legacy', ...options });
  }
}
