/**
 * Default configuration for new Cortex instances
 */

export const DEFAULT_LISTS = [
  'Work',
  'Personal',
  'Health',
  'Finance',
  'Home',
  'Travel',
];

export const MEMORY_CATEGORIES = [
  'context',
  'decision',
  'learning',
  'preference',
  'identity',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const ACTIVITY_TYPES = [
  'email',
  'call',
  'meeting',
  'linkedin',
  'note',
  'proposal',
  'other',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PIPELINE_STAGES = [
  'Identify',
  'Qualify',
  'Engage',
  'Propose',
  'Close',
  'Nurture',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const TASK_IMPORTANCE = ['normal', 'high'] as const;
export type TaskImportance = (typeof TASK_IMPORTANCE)[number];
