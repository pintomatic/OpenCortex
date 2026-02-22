/**
 * OpenAPI 3.0 schema — self-documenting endpoint directory
 */

import { Router, Request, Response } from 'express';

export const schemaRouter = Router();

const SCHEMA = {
  openapi: '3.0.0',
  info: {
    title: 'Cortex API',
    version: '1.0.0',
    description:
      'AI Chief of Staff — persistent memory, tasks, CRM, and integrations for Claude.',
  },
  servers: [{ url: '/api' }],
  paths: {
    // Tier 1: Core
    '/bootstrap': {
      get: {
        summary: 'Load full user context at conversation start',
        tags: ['Core'],
        parameters: [
          { name: 'max_tokens', in: 'query', schema: { type: 'integer' }, description: 'Limit response size' },
        ],
      },
    },
    '/schema': {
      get: { summary: 'This endpoint — OpenAPI 3.0 spec', tags: ['Core'] },
    },
    '/memories': {
      get: {
        summary: 'List memories with optional filters',
        tags: ['Memories'],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'domain', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
      },
      post: {
        summary: 'Create a new memory',
        tags: ['Memories'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string' },
                  category: { type: 'string', enum: ['context', 'decision', 'learning', 'preference', 'identity'] },
                  domain: { type: 'string' },
                  subjects: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  source: { type: 'string', enum: ['manual', 'conversation', 'import'] },
                },
              },
            },
          },
        },
      },
    },
    '/memories/search': {
      get: {
        summary: 'Search memories by keyword',
        tags: ['Memories'],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
      },
    },
    '/memories/{id}': {
      get: { summary: 'Get a single memory', tags: ['Memories'] },
      patch: { summary: 'Update a memory', tags: ['Memories'] },
      delete: { summary: 'Delete a memory', tags: ['Memories'] },
    },
    '/domains': {
      get: { summary: 'List memory domains with counts', tags: ['Memories'] },
    },
    '/domain/{domain}': {
      get: { summary: 'Get all memories for a specific domain', tags: ['Memories'] },
    },
    '/tasks': {
      get: {
        summary: 'List tasks with optional filters',
        tags: ['Tasks'],
        parameters: [
          { name: 'listName', in: 'query', schema: { type: 'string' } },
          { name: 'completed', in: 'query', schema: { type: 'boolean' } },
          { name: 'importance', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
      },
      post: {
        summary: 'Create a new task',
        tags: ['Tasks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'listName'],
                properties: {
                  title: { type: 'string' },
                  listName: { type: 'string' },
                  body: { type: 'string' },
                  dueDate: { type: 'string', format: 'date' },
                  importance: { type: 'string', enum: ['normal', 'high'] },
                },
              },
            },
          },
        },
      },
    },
    '/tasks/search': {
      get: {
        summary: 'Search tasks by keyword',
        tags: ['Tasks'],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
      },
    },
    '/tasks/summary': {
      get: { summary: 'Task statistics (total, overdue, due soon, high priority)', tags: ['Tasks'] },
    },
    '/tasks/upcoming': {
      get: {
        summary: 'Tasks due within N days',
        tags: ['Tasks'],
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 7 } }],
      },
    },
    '/tasks/{id}': {
      get: { summary: 'Get a single task', tags: ['Tasks'] },
      patch: { summary: 'Update a task', tags: ['Tasks'] },
      delete: { summary: 'Delete a task', tags: ['Tasks'] },
    },
    '/tasks/for-contact/{name}': {
      get: { summary: 'Tasks mentioning a specific person', tags: ['Tasks'] },
    },
    '/lists': {
      get: { summary: 'List all task lists', tags: ['Lists'] },
      post: { summary: 'Create a new list', tags: ['Lists'] },
    },
    '/lists/{id}': {
      delete: { summary: 'Delete a list', tags: ['Lists'] },
    },
    '/keys': {
      get: { summary: 'List API keys (masked)', tags: ['Keys'] },
    },
    '/keys/rotate': {
      post: { summary: 'Generate a new API key', tags: ['Keys'] },
    },
    '/keys/{keyId}': {
      delete: { summary: 'Revoke a specific API key', tags: ['Keys'] },
    },

    // Tier 2: Relationships
    '/accounts': {
      get: { summary: 'List accounts/companies', tags: ['CRM'] },
      post: { summary: 'Create an account', tags: ['CRM'] },
    },
    '/accounts/{id}': {
      get: { summary: 'Get account details', tags: ['CRM'] },
      patch: { summary: 'Update an account', tags: ['CRM'] },
      delete: { summary: 'Delete an account', tags: ['CRM'] },
    },
    '/contacts': {
      get: {
        summary: 'List contacts with optional filters',
        tags: ['CRM'],
        parameters: [
          { name: 'accountId', in: 'query', schema: { type: 'string' } },
          { name: 'pipelineStage', in: 'query', schema: { type: 'string' } },
          { name: 'hidden', in: 'query', schema: { type: 'boolean', default: false } },
        ],
      },
      post: { summary: 'Create a contact', tags: ['CRM'] },
    },
    '/contacts/{id}': {
      patch: { summary: 'Update a contact', tags: ['CRM'] },
      delete: { summary: 'Delete a contact', tags: ['CRM'] },
    },
    '/contacts/{id}/activities': {
      get: { summary: 'List activities for a contact', tags: ['CRM'] },
      post: { summary: 'Log an activity for a contact', tags: ['CRM'] },
    },
    '/contacts/{id}/activities/{activityId}': {
      patch: { summary: 'Update an activity', tags: ['CRM'] },
      delete: { summary: 'Delete an activity', tags: ['CRM'] },
    },
    '/contacts/{id}/latest-activity': {
      get: { summary: 'Most recent activity + days since', tags: ['CRM'] },
    },
    '/contacts/{id}/hide': {
      post: { summary: 'Soft-delete a contact', tags: ['CRM'] },
    },
    '/pipeline': {
      get: { summary: 'Pipeline overview grouped by stage', tags: ['CRM'] },
    },
    '/meeting-prep/{memberId}': {
      get: { summary: 'Full context bundle for meeting preparation', tags: ['CRM'] },
    },
    '/transcripts': {
      get: { summary: 'List transcripts', tags: ['Transcripts'] },
      post: { summary: 'Store a meeting transcript', tags: ['Transcripts'] },
    },
    '/plans': {
      post: { summary: 'Create a strategic plan', tags: ['Plans'] },
    },
    '/plans/{id}': {
      patch: { summary: 'Update a plan', tags: ['Plans'] },
    },

    // Tier 3: Integrations
    '/calendar/events': {
      get: { summary: 'List calendar events', tags: ['Calendar'] },
      post: { summary: 'Create a calendar event', tags: ['Calendar'] },
    },
    '/calendar/events/{eventId}': {
      patch: { summary: 'Update a calendar event', tags: ['Calendar'] },
      delete: { summary: 'Delete a calendar event', tags: ['Calendar'] },
    },
    '/calendar/today': {
      get: { summary: "Today's events", tags: ['Calendar'] },
    },
    '/calendar/upcoming': {
      get: { summary: 'Events in the next N days', tags: ['Calendar'] },
    },
    '/emails/recent': {
      get: { summary: 'Recent emails', tags: ['Email'] },
    },
    '/emails/search': {
      get: { summary: 'Search emails', tags: ['Email'] },
    },
    '/emails/{id}': {
      get: { summary: 'Read a specific email', tags: ['Email'] },
    },
    '/emails/send': {
      post: { summary: 'Send an email', tags: ['Email'] },
    },
    '/emails/{id}/reply': {
      post: { summary: 'Reply to an email', tags: ['Email'] },
    },
  },
};

schemaRouter.get('/schema', (_req: Request, res: Response) => {
  res.json(SCHEMA);
});
