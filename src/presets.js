import { randomUUID } from 'node:crypto';
import { TERMINAL } from './tasks.js';
import { MAX_TEAM, roleMember } from './roles.js';

const preset = (title, lead, reviewer, names) => ({
  title,
  lead,
  reviewer,
  members: names.map(key => roleMember(key)),
});
export const BUILTIN_PRESETS = {
  default: {
    title: 'General project crew',
    lead: 'chief',
    reviewer: 'reviewer',
    members: [
      roleMember('project-lead', 'chief'),
      roleMember('researcher'),
      roleMember('fullstack-dev', 'developer'),
      roleMember('qa-reviewer', 'reviewer'),
    ],
  },
  web: preset('Fullstack web', 'project-lead', 'qa-reviewer', [
    'project-lead',
    'architect',
    'ui-ux-designer',
    'frontend-dev',
    'backend-dev',
    'database-dev',
    'devops',
    'test-engineer',
    'security-reviewer',
    'seo-aeo-geo-specialist',
    'version-control',
    'qa-reviewer',
  ]),
  mobile: preset('Fullstack mobile', 'project-lead', 'qa-reviewer', [
    'project-lead',
    'architect',
    'ui-ux-designer',
    'mobile-dev',
    'backend-dev',
    'database-dev',
    'devops',
    'test-engineer',
    'security-reviewer',
    'accessibility-reviewer',
    'version-control',
    'qa-reviewer',
  ]),
  social: preset('Social media', 'social-manager', 'analytics-reviewer', [
    'social-manager',
    'researcher',
    'content-strategist',
    'copywriter',
    'creative-designer',
    'community-manager',
    'seo-aeo-geo-specialist',
    'analytics-reviewer',
  ]),
  clipper: preset('Facebook & YouTube video clips', 'video-producer', 'video-reviewer', [
    'video-producer',
    'footage-analyst',
    'video-editor',
    'captioner',
    'copywriter',
    'video-reviewer',
  ]),
  content: preset('Content creation', 'editor', 'content-reviewer', [
    'editor',
    'researcher',
    'content-strategist',
    'writer',
    'creative-designer',
    'seo-aeo-geo-specialist',
    'content-reviewer',
  ]),
};
export class Presets {
  constructor(crew) {
    this.crew = crew;
  }
  list() {
    return { ...BUILTIN_PRESETS, ...Object.fromEntries(this.crew.state.presets.map(p => [p.name, p])) };
  }
  get(name) {
    const preset = this.list()[name];
    if (!Object.hasOwn(this.list(), name) || !preset) throw new Error('Unknown preset. Use /preset list.');
    return preset;
  }
  idle() {
    const crew = this.crew;
    if (
      crew.running.size ||
      crew.state.tasks.some(t => ['queued', 'waiting'].includes(t.status)) ||
      crew.state.workflows.some(f => !TERMINAL.has(f.status)) ||
      crew.discussions.current?.status === 'working'
    ) {
      throw new Error('Stop running work and cancel queued tasks/workflows before changing the crew. Use /stop all.');
    }
  }
  save(name, leadName = this.crew.leadName, reviewerName = this.crew.reviewerName) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(name || ''))
      throw new Error('Use a lowercase preset name, up to 32 letters, numbers or hyphens.');
    if (Object.hasOwn(BUILTIN_PRESETS, name)) throw new Error('Cannot replace a built-in preset. Choose another name.');
    this.crew.member(leadName);
    if (this.crew.member(reviewerName).writable || leadName === reviewerName)
      throw new Error('Choose a separate read-only reviewer.');
    if (this.crew.state.members.length > MAX_TEAM) throw new Error(`Presets support up to ${MAX_TEAM} teammates.`);
    const preset = {
      name,
      title: this.crew.state.presets.find(p => p.name === name)?.title || name,
      lead: leadName,
      reviewer: reviewerName,
      members: this.crew.state.members.map(({ name, role, writable, personality }) => ({
        name,
        role,
        writable,
        ...(personality ? { personality } : {}),
      })),
    };
    this.crew.state.presets = this.crew.state.presets.filter(p => p.name !== name);
    this.crew.state.presets.push(preset);
    this.crew.save();
  }
  custom(name) {
    if (Object.hasOwn(BUILTIN_PRESETS, name)) throw new Error('Cannot edit or delete a built-in preset.');
    const saved = this.crew.state.presets.find(p => p.name === name);
    if (!saved) throw new Error('Unknown custom preset. Use /preset list.');
    return saved;
  }
  title(name, text) {
    const saved = this.custom(name);
    if (!text?.trim() || text.length > 200 || /[\x00-\x1f\x7f]/.test(text))
      throw new Error('Use a title of 1-200 characters without control characters.');
    saved.title = text.trim();
    this.crew.save();
  }
  delete(name) {
    this.custom(name);
    this.crew.state.presets = this.crew.state.presets.filter(p => p.name !== name);
    if (this.crew.state.activePreset === name) this.crew.state.activePreset = null;
    this.crew.save();
  }
  apply(name) {
    const preset = this.get(name);
    this.idle();
    this.crew.state.archives.push({
      id: randomUUID().slice(0, 8),
      at: new Date().toISOString(),
      reason: `preset ${name}`,
      kind: 'preset',
      members: structuredClone(this.crew.state.members),
      coordination: structuredClone(this.crew.state.coordination || null),
      activePreset: this.crew.state.activePreset || null,
    });
    this.crew.state.members = preset.members.map(m => ({
      ...structuredClone(m),
      status: 'ready',
      messages: [],
      threadId: null,
    }));
    this.crew.state.activeConversations = Object.create(null);
    for (const job of this.crew.state.schedules) job.enabled = false;
    this.crew.state.coordination = { lead: preset.lead, reviewer: preset.reviewer };
    this.crew.state.activePreset = name;
    this.crew.save();
    this.crew.notify(`Applied ${name} preset; previous crew archived. /undo to restore.`);
  }
  restore(id) {
    this.idle();
    const snapshot = this.crew.state.archives.find(a => a.id === id && a.kind === 'preset');
    if (!snapshot) throw new Error('Choose a preset archive ID from /archives.');
    this.crew.state.archives.push({
      id: randomUUID().slice(0, 8),
      at: new Date().toISOString(),
      reason: 'preset restore',
      kind: 'preset',
      members: structuredClone(this.crew.state.members),
      coordination: structuredClone(this.crew.state.coordination || null),
      activePreset: this.crew.state.activePreset || null,
    });
    this.crew.state.members = structuredClone(snapshot.members);
    for (const m of this.crew.state.members) m.status = 'ready';
    this.crew.state.coordination = snapshot.coordination || null;
    this.crew.normalizeDefaultCoordination();
    this.crew.state.activePreset = snapshot.activePreset || null;
    this.crew.save();
    this.crew.notify(`Restored crew archive ${id}`);
  }
}
