import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { stateDirectory } from './storage.js';
const exec = promisify(execFile);
const samePath = (a, b) =>
  process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : a === b;

export class Worktrees {
  constructor(crew) {
    this.crew = crew;
  }
  async git(args, folder = this.crew.folder) {
    const { stdout } = await exec('git', args, {
      cwd: folder,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout.trim();
  }
  async create() {
    const id = randomUUID().slice(0, 8),
      branch = `pongkan/${id}`;
    const root = await this.git(['rev-parse', '--show-toplevel']);
    // Native resolution expands Windows short names and removes namespace prefixes.
    if (!samePath(realpathSync.native(root), realpathSync.native(this.crew.folder)))
      throw new Error('Open the Git repository root before starting an isolated workflow.');
    const baseCommit = await this.git(['rev-parse', '--verify', 'HEAD']);
    if (await this.git(['status', '--porcelain', '--untracked-files=no']))
      throw new Error(
        'Commit or stash tracked changes before creating an isolated workflow. Worktrees start from HEAD.',
      );
    const directory = join(stateDirectory(this.crew.folder), 'worktrees');
    mkdirSync(directory, { recursive: true });
    if (lstatSync(directory).isSymbolicLink() || !samePath(realpathSync(directory), directory))
      throw new Error('Unsafe worktree directory.');
    const workspace = join(directory, id);
    await this.git(['-c', 'core.hooksPath=', 'worktree', 'add', '-b', branch, workspace, 'HEAD']);
    return { id, workspace, branch, baseCommit };
  }
  verify(flow) {
    const expected = join(this.crew.folder, '.pongkan-crew', 'worktrees', flow.id);
    if (
      !samePath(flow.workspace, expected) ||
      lstatSync(expected).isSymbolicLink() ||
      !samePath(realpathSync(expected), expected)
    )
      throw new Error('Unsafe or missing isolated workflow directory.');
    return expected;
  }
  async diff(id) {
    const flow = this.crew.workflows.get(id);
    if (!flow.workspace) throw new Error('This workflow has no isolated worktree.');
    const folder = this.verify(flow);
    return [
      `Branch: ${flow.branch}`,
      `Folder: ${folder}`,
      '',
      await this.git(['status', '--short'], folder),
      await this.git(['diff', flow.baseCommit || 'HEAD', '--'], folder),
    ].join('\n');
  }
  async review(id) {
    const flow = this.crew.workflows.get(id);
    if (!flow.workspace) throw new Error('This workflow has no isolated worktree.');
    const folder = this.verify(flow);
    const [target, source, status, targetStatus] = await Promise.all([
      this.git(['rev-parse', '--verify', 'HEAD']),
      this.git(['rev-parse', '--verify', 'HEAD'], folder),
      this.git(['status', '--short'], folder),
      this.git(['status', '--short']),
    ]);
    const base = await this.git(['merge-base', target, source], folder);
    const [changed, targetChanged, summary, commits] = await Promise.all([
      this.git(['diff', '--name-only', '-z', base, '--'], folder),
      this.git(['diff', '--name-only', '-z', base, target, '--']),
      this.git(['diff', '--stat', base, '--'], folder),
      this.git(['rev-list', '--left-right', '--count', `${target}...${source}`], folder),
    ]);
    const targetFiles = new Set(targetChanged.split('\0').filter(Boolean));
    const overlapping = changed.split('\0').filter(path => targetFiles.has(path));
    const [behind, ahead] = commits.split(/\s+/);
    const active = this.crew.state.tasks.some(task => task.workflowId === id && task.status === 'running');
    const warnings = [
      ...(active ? ['An assignment is running; changes may still be in progress.'] : []),
      ...(status
        ? ['Isolated worktree has uncommitted or untracked changes; these are excluded from a branch merge.']
        : []),
      ...(targetStatus ? ['Target workspace has uncommitted or untracked changes.'] : []),
      ...(overlapping.length ? [`Both sides changed: ${overlapping.join(', ')}. Inspect for conflicts.`] : []),
    ];
    return [
      `Workflow: ${id} · ${flow.status}`,
      `Branch: ${flow.branch}`,
      `Folder: ${folder}`,
      `Target: current project HEAD ${target}`,
      `Source HEAD: ${source}`,
      `Commits ahead: ${ahead}; behind: ${behind}`,
      `Readiness: ${warnings.length ? 'needs inspection' : ahead === '0' ? 'no committed changes to merge' : 'no obvious blockers detected'}`,
      ...warnings,
      'Preview only: file overlap is not a merge simulation. No conflict-free merge is guaranteed.',
      '',
      'ISOLATED STATUS',
      status || '(clean)',
      '',
      'TARGET STATUS',
      targetStatus || '(clean)',
      '',
      'CHANGES SINCE COMMON ANCESTOR (includes tracked local edits)',
      summary || '(none)',
      '',
      'ACCEPTANCE',
      `Outcome: ${flow.outcome || 'unverified'}; /workflow criteria ${id}`,
      `Inspect full tracked diff: /worktree show ${id}. Inspect untracked file contents separately.`,
    ];
  }
}
