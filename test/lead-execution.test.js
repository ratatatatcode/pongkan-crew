import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { validateState } from '../src/state.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { writeFileSync } from 'node:fs';

const decision = (action, member = null, instruction = '', summary = 'Next action') => ({
  action,
  member,
  instruction,
  summary,
  boundary: null,
});
const verified = () => ({
  outcome: 'met',
  summary: 'Artifacts independently checked.',
  criteria: [{ requirement: 'Deliver the requested artifact', status: 'pass', evidence: 'Inspected current output.' }],
});
function setup(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-lead-'));
  const calls = [];
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      const task = crew.state.tasks.find(task => task.status === 'running');
      calls.push({ task: { ...task }, args, prompt });
      event({ type: 'thread.started', thread_id: `session-${task.member}` });
      const value = await respond(task, calls, crew, event);
      event({
        type: 'item.completed',
        item: { type: 'agent_message', text: typeof value === 'string' ? value : JSON.stringify(value) },
      });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, calls };
}
function inspect(event, output = 'artifact valid') {
  event({
    type: 'item.completed',
    item: {
      type: 'command_execution',
      command: 'inspect artifact',
      status: 'completed',
      exit_code: 0,
      aggregated_output: output,
    },
  });
}

test('new workflows delegate one action at a time and keep a private-isolated persistent lead session', async t => {
  let leadTurns = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) {
      leadTurns++;
      return leadTurns === 1
        ? decision('delegate', 'developer', 'Build artifact')
        : leadTurns === 2
          ? decision('review', 'reviewer', 'Inspect artifact')
          : decision('complete', null, '', 'Ready for delivery.');
    }
    inspect(event);
    return task.kind === 'review' ? verified() : 'Built artifact.';
  });
  crew.member('chief').threadId = 'private-session';
  crew.member('chief').messages.push({ role: 'user', text: 'PRIVATE_SECRET' });
  const discussion = crew.discussions.newConversation();
  const flow = crew.workflows.start('Deliver artifact', { requiresWrite: true, sourceDiscussionId: discussion.id });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.engine, 'lead');
  assert.equal(flow.status, 'completed');
  assert.equal(flow.outcome, 'met');
  assert.equal(flow.result, 'Ready for delivery.');
  assert.deepEqual(
    calls.map(call => call.task.member),
    ['chief', 'developer', 'chief', 'reviewer', 'chief'],
    JSON.stringify(crew.state.tasks.map(({ member, status, error }) => ({ member, status, error }))),
  );
  assert.ok(!calls[0].args.includes('resume'));
  assert.ok(calls[2].args.includes('session-chief'));
  assert.ok(calls.every(call => !call.args.includes('private-session') && !call.prompt.includes('PRIVATE_SECRET')));
  assert.equal(crew.member('chief').threadId, 'private-session');
  assert.equal(flow.sessions.chief.threadId, 'session-chief');
  assert.match(calls[2].prompt, /Built artifact/);
  assert.ok(calls[0].args.includes('read-only'));
  validateState(crew.state);
});

test('lead cannot complete without independent verification, even when it claims success', async t => {
  let turns = 0;
  const { crew } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) {
      turns++;
      return decision('complete', null, '', 'Done.');
    }
    inspect(event);
    return verified();
  });
  const flow = crew.workflows.start('Inspect artifact', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(turns, 2);
  assert.ok(crew.state.tasks.some(task => task.kind === 'review' && task.verificationFormatted));
});

test('failed worker continues in its own session before the lead chooses the next action', async t => {
  let leads = 0,
    workers = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads === 1
        ? decision('delegate', 'developer', 'Build artifact')
        : decision('complete', null, '', 'Delivered.');
    if (task.kind === 'review') {
      inspect(event);
      return verified();
    }
    workers++;
    if (workers === 1) return 'PONGKAN_BLOCKED: Tool failed; need to investigate alternatives.';
    inspect(event);
    return 'Artifact built using another approach.';
  });
  const flow = crew.workflows.start('Deliver artifact', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const turns = calls.filter(call => call.task.member === 'developer');
  assert.equal(turns.length, 2);
  assert.ok(turns[1].args.includes('session-developer'));
  assert.match(turns[1].prompt, /Tool failed/);
  assert.ok(!crew.state.tasks.some(task => task.recoveryFor));
});

test('missing independent inspection remains unverified and is not reported complete', async t => {
  const { crew } = setup(t, task => (task.leadDecision ? decision('complete') : verified()));
  const flow = crew.workflows.start('Deliver artifact', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.equal(flow.outcome, 'unverified');
  assert.match(flow.error, /verification/i);
});

test('overall model-turn budget stops new dispatch without pretending the work failed verification', async t => {
  const { crew, calls } = setup(t, task =>
    task.leadDecision ? decision('delegate', 'developer', 'Inspect artifact') : 'Findings.',
  );
  const flow = crew.workflows.start('Inspect artifact', { turnBudget: 2 });
  await crew.workflows.settled(flow.id);
  assert.equal(calls.length, 2);
  assert.match(flow.error, /budget/i);
  assert.ok(!flow.error.includes('12-attempt'));
  assert.notEqual(flow.outcome, 'met');
});

test('repeated delegation without new evidence stops rather than cycling to twelve attempts', async t => {
  const { crew, calls } = setup(t, task =>
    task.leadDecision ? decision('delegate', 'developer', 'Inspect artifact') : 'Still investigating.',
  );
  const flow = crew.workflows.start('Inspect artifact');
  await crew.workflows.settled(flow.id);
  assert.match(flow.error, /without new evidence/i);
  assert.ok(calls.length < 12);
});

test('lead questions pause and an answer resumes the same lead session', async t => {
  let leads = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads === 1
        ? decision('question', null, 'Which output format?')
        : decision('complete', null, '', 'Delivered MP4.');
    inspect(event);
    return verified();
  });
  const flow = crew.workflows.start('Deliver artifact');
  while (!crew.state.tasks.some(task => task.workflowId === flow.id && task.status === 'waiting'))
    await new Promise(resolve => setTimeout(resolve, 5));
  const waiting = crew.state.tasks.find(task => task.status === 'waiting');
  crew.queue.answer(waiting.id, 'MP4');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.match(calls.filter(call => call.task.leadDecision)[1].prompt, /Answer: MP4/);
});

test('crew-task command starts the lead engine using shared history', async t => {
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Delivered.');
    inspect(event);
    return verified();
  });
  const discussion = crew.discussions.newConversation();
  discussion.messages.push({ role: 'user', speaker: 'you', text: 'SHARED_GOAL' });
  execute({ crew, selected: 'chief', view: 'group' }, '/crew-task Deliver artifact');
  const flow = crew.state.workflows.at(-1);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.engine, 'lead');
  assert.match(calls[0].prompt, /SHARED_GOAL/);
});

test('restart resumes the interrupted worker session and preserves member models, roles and skills context', async t => {
  const { crew } = setup(t, () => 'unused');
  crew.queue.pause();
  const flow = crew.workflows.start('Deliver artifact', { requiresWrite: true });
  const lead = crew.state.tasks.find(task => task.workflowId === flow.id);
  lead.status = 'completed';
  lead.result = 'Developer, build artifact.';
  flow.sessions.developer = { threadId: 'saved-worker' };
  flow.sessions.chief = { threadId: 'saved-lead' };
  const worker = crew.queue.enqueue('developer', 'Build remaining artifact', {
    workflowId: flow.id,
    kind: 'work',
    hold: true,
  });
  worker.status = 'running';
  crew.member('developer').model = 'test-model';
  crew.member('developer').reasoningEffort = 'high';
  crew.memory.add('Project memory must survive.');
  crew.save();
  let workers = 0;
  const calls = [];
  const restored = new Crew(crew.folder, {
    runner: async (args, prompt, event) => {
      const task = restored.state.tasks.find(task => task.status === 'running');
      calls.push({ args, prompt, member: task.member });
      let result;
      if (task.leadDecision) result = decision('complete', null, '', 'Delivered after restart.');
      else {
        inspect(event);
        result = task.kind === 'review' ? verified() : 'Resumed worker finished.';
        if (task.kind === 'work') workers++;
      }
      event({
        type: 'item.completed',
        item: { type: 'agent_message', text: typeof result === 'string' ? result : JSON.stringify(result) },
      });
    },
  });
  const resumed = restored.workflows.resume(flow.id);
  restored.queue.resumeScope(task => task.workflowId === flow.id);
  await restored.workflows.settled(flow.id);
  assert.equal(resumed.status, 'completed');
  assert.equal(workers, 1);
  assert.ok(calls[0].args.includes('saved-worker'));
  assert.ok(calls[0].args.includes('test-model'));
  assert.match(calls[0].prompt, /Project memory must survive/);
  assert.match(calls[0].prompt, /repository instructions and skills/i);
  assert.equal(restored.member('developer').role, crew.member('developer').role);
  validateState(restored.state);
  await restored.close();
});

test('budget command allows explicit continuation with artifacts and completed tasks intact', async t => {
  const { crew } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Delivered.');
    inspect(event);
    return verified();
  });
  const flow = crew.workflows.start('Deliver artifact', { turnBudget: 1 });
  await crew.workflows.settled(flow.id);
  const completed = crew.state.tasks.filter(task => task.status === 'completed').map(task => task.id);
  writeFileSync(join(crew.folder, 'artifact.txt'), 'Preserved');
  const app = { crew, selected: 'chief', view: 'group' };
  execute(app, `/workflow budget ${flow.id} 8`);
  execute(app, `/workflow resume ${flow.id}`);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.ok(completed.every(id => crew.queue.get(id).status === 'completed'));
});

test('cancellation stops the lead workflow without starting later actions', async t => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const { crew, calls } = setup(t, async () => {
    await gate;
    return decision('delegate', 'developer', 'Build artifact');
  });
  const flow = crew.workflows.start('Deliver artifact');
  const task = crew.state.tasks.find(task => task.workflowId === flow.id);
  crew.queue.cancel(task.id);
  release();
  await Promise.allSettled([...crew.queue.inflight]);
  assert.equal(flow.status, 'cancelled');
  assert.equal(calls.length, 1);
});

test('direct turns investigate failures in the same session with their original permissions', async t => {
  let turns = 0;
  const { crew, calls } = setup(t, (_task, _calls, _crew, event) => {
    turns++;
    if (turns === 1) return 'PONGKAN_BLOCKED: First approach failed; investigate another approach.';
    inspect(event);
    return 'Done after investigation.';
  });
  const task = crew.queue.enqueue('developer', 'Build artifact');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].args.includes('session-developer'));
  assert.ok(calls.every(call => call.args.includes('--approve-for-me')));
  assert.ok(calls.every(call => !call.prompt.includes('PONGKAN_TASK_RECOVERY')));
});

test('private lead replies are readable and do not replay the private session into delegates', async t => {
  const { crew } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Ready for local delivery.');
    inspect(event);
    return verified();
  });
  const flow = crew.workflows.start('Inspect artifact');
  await crew.workflows.settled(flow.id);
  const visible = screen(crew, 'chief', '', '', 120, 80);
  assert.match(visible, /Ready for local delivery/);
  assert.doesNotMatch(visible, /"action"|"boundary"/);
});

test('required verification gaps return to the lead for a useful correction and reinspection', async t => {
  let leads = 0,
    reviews = 0;
  const { crew } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads === 2
        ? decision('delegate', 'developer', 'Provide the missing functional check')
        : decision('complete', null, '', 'Delivered after checking.');
    inspect(event, `inspection-${reviews}`);
    if (task.kind !== 'review') return 'Functional check now available.';
    reviews++;
    if (reviews === 1)
      return {
        outcome: 'unverified',
        summary: 'Functional check unavailable.',
        criteria: [
          { requirement: 'Deliver the requested artifact', status: 'unverified', evidence: 'Need a functional check.' },
        ],
      };
    return verified();
  });
  const flow = crew.workflows.start('Deliver artifact');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(reviews, 2);
});

test('new execution can make progress beyond twelve wrapper turns within its overall budget', async t => {
  let leads = 0,
    workers = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads <= 7
        ? decision('delegate', 'developer', `Deliver part ${leads}`)
        : decision('complete', null, '', 'Delivered all parts.');
    inspect(event, `part-${++workers}`);
    return task.kind === 'review' ? verified() : `Part ${workers} delivered.`;
  });
  const flow = crew.workflows.start('Deliver artifact');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.ok(calls.length > 12);
});

test('unchanged failed acceptance cannot be hidden by fresh review probe output', async t => {
  let probes = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('review', 'reviewer', 'Check artifact');
    inspect(event, `fresh-output-${++probes}`);
    return {
      outcome: 'needs_work',
      summary: 'Artifact missing.',
      criteria: [{ requirement: 'Deliver artifact', status: 'fail', evidence: 'No artifact exists.' }],
    };
  });
  const flow = crew.workflows.start('Deliver artifact');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.match(flow.error, /without new evidence/);
  assert.ok(calls.length < 12);
});

test('corrupted lead session and budget state are rejected on load', t => {
  const { crew } = setup(t, () => 'unused');
  crew.queue.pause();
  const flow = crew.workflows.start('Inspect artifact');
  const state = structuredClone(crew.state);
  state.workflows[0].sessions.chief = { threadId: 123 };
  assert.throws(() => validateState(state));
  flow.turnBudget = -1;
  assert.throws(() => validateState(crew.state));
  flow.turnBudget = 64;
});

test('explicit resume upgrades older stopped workflows without repeating completed artifacts', async t => {
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Existing artifact accepted.');
    inspect(event);
    return verified();
  });
  crew.queue.pause();
  const flow = crew.workflows.start('Deliver artifact', { engine: 'legacy', requiresWrite: true });
  delete flow.engine; // State written before the lead engine existed.
  const completed = crew.state.tasks.find(task => task.workflowId === flow.id);
  completed.status = 'completed';
  completed.result = 'Completed artifact is available.';
  const pending = crew.queue.enqueue('developer', 'Old pending assignment', {
    workflowId: flow.id,
    kind: 'work',
    hold: true,
  });
  pending.answers = [{ question: 'Chosen output?', answer: 'MP4_ONLY' }];
  flow.status = 'failed';
  flow.error = 'Reached 12-attempt recovery limit.';
  flow.recoveryAttempts = 12;
  const resumed = crew.workflows.resume(flow.id);
  crew.queue.resumeScope(task => task.workflowId === flow.id);
  await crew.workflows.settled(flow.id);
  assert.equal(resumed.engine, 'lead');
  assert.equal(resumed.status, 'completed');
  assert.equal(completed.result, 'Completed artifact is available.');
  assert.equal(pending.status, 'cancelled');
  assert.ok(calls.every(call => call.task.member !== 'developer'));
  assert.match(calls[0].prompt, /Completed artifact is available/);
  assert.match(calls[0].prompt, /MP4_ONLY/);
  validateState(crew.state);
});

test('a failed newer review cannot reuse an earlier accepted verification', async t => {
  let leads = 0,
    reviews = 0;
  const { crew } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads === 2
        ? decision('review', 'reviewer', 'Run a fresh final check')
        : decision('complete', null, '', 'Delivered.');
    if (++reviews === 2) throw new Error('Required check could not run.');
    inspect(event);
    return verified();
  });
  const flow = crew.workflows.start('Deliver artifact');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(reviews, 3);
});

test('pausing and resuming continues the same worker task and workflow session', async t => {
  let release,
    ready,
    leads = 0,
    workers = 0;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const started = new Promise(resolve => {
    ready = resolve;
  });
  const { crew, calls } = setup(t, async (task, _calls, _crew, event) => {
    if (task.leadDecision)
      return ++leads === 1
        ? decision('delegate', 'developer', 'Build artifact')
        : decision('complete', null, '', 'Delivered.');
    if (task.kind === 'work' && ++workers === 1) {
      ready();
      await gate;
      return 'Partial artifact.';
    }
    inspect(event);
    return task.kind === 'review' ? verified() : 'Finished artifact.';
  });
  const flow = crew.workflows.start('Deliver artifact');
  await started;
  crew.workflows.pause(flow.id);
  release();
  await Promise.allSettled([...crew.queue.inflight]);
  assert.equal(flow.status, 'paused');
  const worker = crew.state.tasks.find(task => task.kind === 'work');
  assert.equal(worker.status, 'interrupted');
  crew.workflows.resume(flow.id);
  crew.queue.resumeScope(task => task.workflowId === flow.id);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const work = calls.filter(call => call.task.kind === 'work');
  assert.equal(work.length, 2);
  assert.equal(work[0].task.id, work[1].task.id);
  assert.ok(work[1].args.includes('session-developer'));
});

test('reworded review criteria and fresh lead probes cannot reset stalled acceptance', async t => {
  let leads = 0,
    reviews = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) {
      inspect(event, `fresh-lead-probe-${++leads}`);
      return decision('complete', null, '', 'Deliver with the accepted playback limitation.');
    }
    inspect(event, `fresh-review-probe-${++reviews}`);
    return {
      outcome: 'unverified',
      summary: 'The same playback limitation remains.',
      criteria: [
        {
          requirement: `Record playback limitation, phrasing ${reviews}`,
          status: 'unverified',
          evidence: 'Continuous playback remains unchecked.',
        },
      ],
    };
  });
  const flow = crew.workflows.start('Deliver local packages; continuous playback may remain unverified.');
  await crew.workflows.settled(flow.id);
  assert.ok(calls.length < 12, `Wasted ${calls.length} model turns on unchanged acceptance.`);
  assert.equal(flow.status, 'failed');
  assert.match(flow.error, /acceptance.*progress|progress.*acceptance/i);
});

test('accepted review limitations are disclosed without becoming unmet requirements', async t => {
  const limitation = 'Continuous playback remains unverified, as permitted by the requested scope.';
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Local packages are ready.');
    inspect(event);
    return { ...verified(), limitations: [limitation] };
  });
  const flow = crew.workflows.start('Deliver local packages; continuous playback may remain unverified.');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.match(flow.result, /Continuous playback remains unverified/);
  assert.deepEqual(flow.limitations, [limitation]);
  assert.match(calls.find(call => call.task.kind === 'review').prompt, /limitations array/);
});

test('questions off and a limitations list do not waive a genuinely missing requirement', async t => {
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) return decision('complete', null, '', 'Ready with limitations.');
    inspect(event);
    return {
      outcome: 'met',
      summary: 'A required output is missing.',
      criteria: [
        { requirement: 'Deliver the required artifact', status: 'fail', evidence: 'The output file does not exist.' },
      ],
      limitations: ['A limitation is disclosed; this does not supply the missing output.'],
    };
  });
  crew.state.questionsEnabled = false;
  const flow = crew.workflows.start('Deliver the required artifact.');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.notEqual(flow.outcome, 'met');
  assert.match(calls[0].prompt, /Questions are OFF/);
  assert.match(flow.error, /output file does not exist/);
  validateState(crew.state);
});

test('reviewer access failure returns to an authorized writer before requesting user action', async t => {
  let leads = 0;
  const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
    if (task.leadDecision) {
      leads++;
      if (leads === 1) return decision('delegate', 'developer', 'Implement the artifact');
      if (leads === 2) return decision('review', 'reviewer', 'Run the required checks');
      if (leads === 3)
        return {
          ...decision('blocked', null, '', 'QA cannot run Node.'),
          boundary: {
            kind: 'unavailable_access',
            evidence: 'Reviewer hit EPERM while loading the project.',
            userAction: 'Provide another execution environment.',
          },
        };
      if (leads === 4) return decision('delegate', 'developer', 'Diagnose and repair the check environment');
      return decision('complete', null, '', 'Delivered after repairing the environment.');
    }
    if (task.kind === 'review' && leads === 2) {
      inspect(event, 'EPERM loading project');
      return {
        outcome: 'unverified',
        summary: 'Node check unavailable.',
        criteria: [{ requirement: 'Run required checks', status: 'unverified', evidence: 'EPERM loading project' }],
      };
    }
    inspect(event);
    return task.kind === 'review' ? verified() : 'Environment repaired and check passed.';
  });
  crew.member('developer').codexPermissions = 'full';
  const flow = crew.workflows.start('Deliver and check artifact', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed', flow.error);
  const correction = calls.filter(call => call.task.leadDecision)[3];
  assert.match(correction.prompt, /danger-full-access/);
  assert.match(correction.prompt, /EPERM loading project/);
  const repair = calls.findLast(call => call.task.member === 'developer');
  assert.equal(calls.filter(call => call.task.member === 'developer').length, 2);
  assert.ok(repair.args.includes('danger-full-access'));
  const reviews = calls.filter(call => call.task.kind === 'review');
  assert.ok(reviews.every(call => call.args.includes('read-only')));
  validateState(crew.state);
});

for (const kind of ['approval_denied', 'credentials', 'user_decision', 'unavailable_access']) {
  test(`evidenced ${kind} boundary still stops dependent work`, async t => {
    let leads = 0;
    const { crew, calls } = setup(t, (task, _calls, _crew, event) => {
      if (task.leadDecision) {
        if (kind === 'unavailable_access' && ++leads === 1)
          return decision('delegate', 'developer', 'Investigate execution access');
        return {
          ...decision('blocked', null, '', 'External prerequisite remains unavailable.'),
          boundary: { kind, evidence: 'Necessary operation was refused.', userAction: 'Provide the required access.' },
        };
      }
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'required-check',
          status: 'failed',
          exit_code: 1,
          aggregated_output: 'Necessary operation was refused.',
        },
      });
      return 'Operation was refused; access prerequisite remains unresolved.';
    });
    const flow = crew.workflows.start('Check artifact');
    await crew.workflows.settled(flow.id);
    assert.equal(flow.status, 'failed');
    assert.match(flow.error, /Provide the required access/);
    assert.equal(calls.length, kind === 'unavailable_access' ? 3 : 1);
    validateState(crew.state);
  });
}
