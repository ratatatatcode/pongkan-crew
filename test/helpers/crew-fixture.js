import { Crew as RealCrew } from './legacy-crew.js';
import decisions from './intent-decisions.json' with { type: 'json' };

// Explicit AI responses for dispatcher scenarios, never a classifier of message text.
const positions = new WeakMap();
export class Crew extends RealCrew {
  constructor(t, ...args) {
    super(...args);
    this.inputs.resolve = (_input, context) => {
      const position = positions.get(t) || 0;
      const response = decisions[t.name]?.[position];
      if (!response) throw new Error('Missing mocked AI decision for ' + t.name);
      positions.set(t, position + 1);
      const flow =
        context.workflows.findLast(
          flow => !['completed', 'cancelled', 'failed', 'interrupted'].includes(flow.status),
        ) || context.workflows.at(-1);
      const candidates = context.assignments.filter(
        task =>
          task.writable &&
          ['queued', 'running'].includes(task.status) &&
          (!response.target || task.member === response.target),
      );
      const writer = candidates.find(task => task.status === 'running') || candidates[0];
      const waiting = context.assignments.find(
        task => task.status === 'waiting' && (!response.target || task.member === response.target),
      );
      return {
        target: null,
        goal: '',
        question: '',
        requiresWrite: false,
        teamDiscussion: true,
        ...response,
        taskId:
          response.action === 'answer'
            ? waiting?.id || null
            : response.action === 'correct'
              ? writer?.id || null
              : null,
        workflowId: ['correct', 'answer', 'resume'].includes(response.action) ? flow?.id || null : null,
      };
    };
    this.inputs.submit = this.inputs.submitInterpreted.bind(this.inputs);
  }
}
