import { TERMINAL } from './tasks.js';
import { steer } from './steering.js';

// Dispatch validated semantic decisions. Message wording is never parsed here.
export function routeNaturalInput(app, text, { submission = 'enter', target = null, decision, requestId = null } = {}) {
  if (!decision) throw new Error('A validated intent decision is required.');
  const crew = app.crew;
  const shared = !!target || app.view === 'group' || app.view === 'activity';
  const conversationId = crew.state.activeConversations[app.selected] || null;
  const flows = shared
    ? crew.discussions.associatedWorkflows()
    : crew.state.workflows.filter(
        flow =>
          !flow.sourceDiscussionId &&
          !flow.sourceConversationId &&
          (flow.conversations?.[app.selected] || null) === conversationId,
      );
  const ids = new Set(flows.map(flow => flow.id));
  const tasks = crew.state.tasks.filter(task =>
    task.workflowId
      ? ids.has(task.workflowId)
      : !shared &&
        !task.discussionId &&
        task.member === app.selected &&
        (task.conversationId || null) === conversationId,
  );
  const flow = decision.workflowId
    ? flows.find(flow => flow.id === decision.workflowId)
    : flows.findLast(flow => !TERMINAL.has(flow.status)) || flows.at(-1);
  const show = notice => {
    app.panel = null;
    app.scroll = 0;
    if (shared) app.view = 'group';
    app.notice = notice;
  };
  const resume = selected =>
    crew.queue.resumeScope(task =>
      selected
        ? task.workflowId === selected.id
        : !shared &&
          !task.workflowId &&
          !task.discussionId &&
          task.member === app.selected &&
          (task.conversationId || null) === conversationId,
    );
  if (decision.action === 'clarify') {
    show(decision.question);
    return true;
  }
  if (decision.action === 'share') {
    const discussion = crew.discussions.share(app.selected, decision.target, decision.goal, { submission });
    decision.discussionId = discussion.id;
    show('Latest private exchange shared; replies appear in its Crew Chat.');
    app.view = 'group';
    return true;
  }
  if (decision.action === 'stop') {
    if (shared) crew.discussions.stop();
    for (const item of flows.filter(
      item => !TERMINAL.has(item.status) && (!decision.workflowId || item.id === decision.workflowId),
    ))
      crew.workflows.cancel(item.id);
    if (!shared)
      for (const task of tasks.filter(task => !task.workflowId && !TERMINAL.has(task.status)))
        crew.queue.cancel(task.id);
    show('Stopped work in this conversation. Say continue to resume unfinished work.');
    return true;
  }
  if (decision.action === 'answer') {
    const task = tasks.find(task => task.id === decision.taskId && task.status === 'waiting');
    if (!task) throw new Error('The requested clarification is no longer waiting.');
    decision.workflowId = task.workflowId || null;
    crew.queue.answer(task.id, text);
    resume(flows.find(flow => flow.id === task.workflowId));
    show(`Answer sent to ${task.member}; continuing the assignment.`);
    return true;
  }
  if (decision.action === 'correct') {
    const task = decision.taskId
      ? tasks.find(task => task.id === decision.taskId)
      : tasks.find(
          task =>
            task.workflowId === flow?.id &&
            ['work', 'revision'].includes(task.kind) &&
            ['queued', 'running'].includes(task.status) &&
            !task.readOnly &&
            crew.member(task.member).writable &&
            (!(decision.target || target) || task.member === (decision.target || target)),
        );
    if (task && ['queued', 'running'].includes(task.status) && !task.readOnly && crew.member(task.member).writable) {
      const correction = steer(crew, task.id, text);
      decision.taskId = task.id;
      decision.workflowId = task.workflowId || null;
      decision.correctionId = correction.id;
      resume(flows.find(flow => flow.id === task.workflowId));
      show(`Correction queued for ${task.member}; it will be delivered at the next task boundary.`);
      return true;
    }
    decision.action = 'execute';
    decision.requiresWrite = true;
  }
  if (decision.action === 'resume') {
    const waiting = tasks.filter(task => task.status === 'waiting' && (!flow || task.workflowId === flow.id));
    if (waiting.length)
      show(
        `An answer is needed before continuing: ${waiting.map(task => `${task.member}: ${task.question}`).join('; ')}`,
      );
    else if (flow && flow.status !== 'completed') {
      if (TERMINAL.has(flow.status)) crew.workflows.resume(flow.id, text);
      resume(flow);
      decision.workflowId = flow.id;
      show('Continuing unfinished work. Completed steps will be kept.');
    } else if (
      shared &&
      crew.discussions.current &&
      ['working', 'failed', 'cancelled', 'interrupted'].includes(crew.discussions.current.status)
    ) {
      const discussion = crew.discussions.current;
      if (discussion.status !== 'working') crew.discussions.resume(discussion, text);
      crew.queue.resumeScope(task => task.discussionId === discussion.id);
      show('Continuing the unfinished discussion.');
    } else if (!shared && tasks.findLast(task => ['failed', 'interrupted', 'cancelled'].includes(task.status))) {
      const task = tasks.findLast(task => ['failed', 'interrupted', 'cancelled'].includes(task.status));
      task.status = 'queued';
      task.continuations = (task.continuations || 0) + 1;
      delete task.error;
      delete task.cancelRequested;
      crew.save();
      resume();
      crew.queue.drain();
      decision.taskId = task.id;
      show('Resuming the unfinished assignment.');
    } else show('There is no unfinished work in this conversation. Tell the crew what you want next.');
    return true;
  }
  if (decision.action === 'execute') {
    if (decision.requiresWrite && !crew.state.members.some(member => member.name !== crew.leadName && member.writable))
      throw new Error(
        'This change needs a writable implementer. Your request is saved; no reviewer was assigned to edit.',
      );
    const goal = decision.goal.trim() || text;
    const authorized =
      goal === text ? text : `${text}\n\nResolved intent (must remain within the original request): ${goal}`;
    const addressed = decision.target || target;
    const request = addressed
      ? `${authorized}\nUser request addressed to ${addressed}: assign implementation to them only if their access permits it. Preserve independent read-only review.`
      : authorized;
    if (shared) {
      let discussion = crew.discussions.current;
      if (!discussion) discussion = crew.discussions.newConversation();
      if (discussion.status === 'working') {
        discussion.pendingExecution = discussion.pendingExecution
          ? `${discussion.pendingExecution}\n\nAdditional user request:\n${request}`
          : request;
        discussion.pendingRequiresWrite ||= decision.requiresWrite;
        const input = crew.state.inputs.find(input => input.id === requestId);
        if (input) {
          input.status = 'dispatched';
          input.pendingDiscussionId = discussion.id;
        }
        crew.save();
        crew.queue.resumeScope(task => task.discussionId === discussion.id);
        show('Your execution request is queued until the current discussion finishes.');
        return true;
      }
      const next = crew.workflows.start(crew.discussions.executionGoal(request), {
        sourceDiscussionId: discussion.id,
        sourceConversationId: crew.state.activeGroupConversation,
        requiresWrite: decision.requiresWrite,
        requestGoal: goal,
        sourceInputId: requestId,
      });
      resume(next);
      show(`Workflow ${next.id} started from your request.`);
    } else {
      if (crew.member(app.selected).writable && !decision.requiresWrite) {
        const task = crew.queue.enqueue(app.selected, request, { conversationId, sourceInputId: requestId });
        decision.taskId = task.id;
        resume();
        show(`Assignment queued for ${task.member}.`);
      } else {
        const next = crew.workflows.start(request, {
          requiresWrite: decision.requiresWrite,
          requestGoal: goal,
          sourceInputId: requestId,
        });
        resume(next);
        show(`Workflow ${next.id} started from your request.`);
      }
    }
    return true;
  }
  if (['discuss', 'status'].includes(decision.action)) {
    if (shared) {
      const queued = crew.discussions.current?.status === 'working';
      const discussion = crew.discussions.start(
        text,
        decision.action === 'status'
          ? crew.leadName
          : decision.target || target || (decision.teamDiscussion ? null : crew.leadName),
        { submission },
      );
      crew.queue.resumeScope(task => task.discussionId === discussion.id);
      show(queued ? 'Your message is queued for the current discussion.' : 'Read-only reply requested.');
    } else {
      const task = crew.queue.enqueue(decision.target || app.selected, text, { readOnly: true, conversationId });
      decision.taskId = task.id;
      resume();
      show(`Reply queued for ${task.member}.`);
    }
    return true;
  }
  throw new Error('Unsupported routing decision. No work was dispatched.');
}
