export function routingQuestions(app) {
  const state = app.crew.state;
  const shared = app.view === 'group' || app.view === 'activity';
  return (state.inputs || []).filter(
    input =>
      input.status === 'blocked' &&
      input.question &&
      !input.answeredAt &&
      input.view === (shared ? 'group' : 'chat') &&
      (input.conversationId || null) ===
        (shared ? state.activeGroupConversation || null : state.activeConversations?.[app.selected] || null) &&
      (shared || input.selected === app.selected),
  );
}

export function answerShortcut(app, input) {
  const clarifications = routingQuestions(app);
  const waiting = [
    ...clarifications.map(input => ({ ...input, member: input.view === 'group' ? 'Crew Chat' : input.selected })),
    ...app.crew.state.tasks.filter(task => task.status === 'waiting'),
  ];
  if (!waiting.length) {
    app.notice = 'No questions waiting for an answer.';
    return input;
  }
  const current = input.match(/^\/answer\s+(\S+)(?:\s([\s\S]*))?$/);
  const index = current ? waiting.findIndex(task => task.id === current[1]) : -1;
  const task =
    index >= 0
      ? waiting[(index + 1) % waiting.length]
      : waiting.find(task => clarifications.some(input => input.id === task.id)) ||
        waiting.find(
          task =>
            task.member === app.selected &&
            (task.conversationId || null) === (app.crew.state.activeConversations?.[app.selected] || null),
        ) ||
        waiting[0];
  app.panel = {
    title: `ANSWER ${task.member}`,
    offset: 0,
    lines: [
      task.question,
      '',
      'Type your reply. Enter or Shift+Left: send answer.',
      'Shift+Right: next question | Esc: close',
    ],
  };
  return `/answer ${task.id} ${current ? current[2] || '' : input}`;
}
