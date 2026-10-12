// Keep command and worker tests independent from the semantic router when
// they specifically exercise direct dispatch behavior.
export function installDirectSubmit(crew) {
  crew.inputs.submit = (app, text, options = {}) => {
    if (crew.inputs.closed) throw new Error('The application is closing.');
    const shared = !!options.target || app.view !== 'chat';
    const member = options.target || (shared ? crew.leadName : app.selected || crew.leadName);
    crew.member(member);
    let task;
    if (shared) {
      const discussion = crew.discussions.start(text, member, { ...options, direct: true });
      task = crew.queue.get(discussion.taskIds.at(-1));
    } else {
      task = crew.queue.enqueue(member, text, { readOnly: !crew.member(member).writable });
    }
    crew.queue.resumeScope(candidate =>
      shared
        ? candidate.discussionId === task.discussionId
        : !candidate.discussionId &&
          candidate.member === member &&
          (candidate.conversationId || null) === (task.conversationId || null),
    );
    app.panel = null;
    app.scroll = 0;
    if (shared) app.view = 'group';
    app.notice = `Message queued for ${member}; ${crew.member(member).writable ? 'write access enabled' : 'read-only access'}.`;
    crew.emit('change');
    return task;
  };
}
