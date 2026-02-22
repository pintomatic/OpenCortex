/**
 * Setup — web-based onboarding flow
 *
 * GET  /setup       → Shows setup form (or "already configured" if done)
 * POST /setup       → Creates user, API key, default lists, returns bootstrap info
 *
 * This replaces the need for any terminal/CLI setup.
 * A non-technical user deploys to Cloud Run, visits /setup, fills in their name,
 * and gets back everything they need to paste into Claude.ai.
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../services/firestore.js';
import { DEFAULT_LISTS } from '../config/defaults.js';

export const setupRouter = Router();

function generateApiKey(): string {
  return 'sc_' + randomBytes(36).toString('base64url');
}

// GET /setup — show the setup page
setupRouter.get('/setup', async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    // Check if already set up (any users exist?)
    const usersSnap = await db.collection('users').limit(1).get();
    const isConfigured = !usersSnap.empty;

    if (isConfigured) {
      const user = usersSnap.docs[0].data();
      res.send(alreadyConfiguredPage(user.name));
      return;
    }

    res.send(setupPage());
  } catch (error) {
    console.error('Setup page error:', error);
    res.status(500).send(errorPage('Could not load setup page. Check that Firestore is accessible.'));
  }
});

// POST /setup — create everything
setupRouter.post('/setup', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Prevent double setup
    const usersSnap = await db.collection('users').limit(1).get();
    if (!usersSnap.empty) {
      res.status(400).json({ error: 'Already configured', hint: 'Cortex is already set up.' });
      return;
    }

    const { name, lists: customLists, instructions } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const now = new Date().toISOString();
    const userId = randomBytes(16).toString('hex');

    // 1. Create user document
    await db.collection('users').doc(userId).set({
      name: name.trim(),
      instructions: instructions || `You are an AI assistant for ${name.trim()}. You have access to their Cortex — a personal knowledge system with memories, tasks, contacts, calendar, and email. Use the API endpoints to help them. Always be concise, warm, and proactive. When you learn something new about ${name.trim()}, save it as a memory. When they mention a to-do, create a task.`,
      createdAt: now,
    });

    // 2. Generate API key
    const apiKey = generateApiKey();
    await db.collection('apiKeys').add({
      userId,
      key: apiKey,
      label: 'default',
      createdAt: now,
      lastUsedAt: null,
    });

    // 3. Seed lists
    const listNames = customLists && Array.isArray(customLists) && customLists.length > 0
      ? customLists
      : DEFAULT_LISTS;

    const batch = db.batch();
    for (const listName of listNames) {
      const ref = db.collection('lists').doc();
      batch.set(ref, { userId, name: listName, createdAt: now });
    }
    await batch.commit();

    // 4. Create initial identity memory
    await db.collection('memories').add({
      userId,
      content: `My name is ${name.trim()}.`,
      category: 'identity',
      domain: 'general',
      subjects: [name.trim()],
      confidence: 1,
      source: 'import',
      createdAt: now,
      updatedAt: now,
    });

    // Build the base URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      success: true,
      userId,
      apiKey,
      baseUrl,
      lists: listNames,
      bootstrapUrl: `${baseUrl}/api/bootstrap?key=${apiKey}`,
      claudeInstructions: `At the start of every conversation, call this URL to load my context:\ncurl -s "${baseUrl}/api/bootstrap?key=${apiKey}"\nParse the JSON response. Follow the instructions field. Use the API endpoints listed to help me.`,
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed', hint: 'Check server logs.' });
  }
});

// ============================================
// HTML PAGES (inline — no template engine needed)
// ============================================

function setupPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex — Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e8e4df; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 560px; width: 100%; padding: 2rem; }
    .logo { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
    .subtitle { color: #a09a93; margin-bottom: 2rem; font-size: 1.1rem; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 2rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1.25rem; }
    label:first-of-type { margin-top: 0; }
    input, textarea { width: 100%; padding: 0.75rem; background: #0f0f0f; border: 1px solid #333; border-radius: 8px; color: #e8e4df; font-size: 1rem; font-family: inherit; }
    input:focus, textarea:focus { outline: none; border-color: #c4956a; }
    textarea { min-height: 80px; resize: vertical; }
    .hint { color: #8a847d; font-size: 0.85rem; margin-top: 0.35rem; }
    .lists-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .list-tag { background: #252525; border: 1px solid #333; border-radius: 6px; padding: 0.4rem 0.75rem; font-size: 0.9rem; cursor: pointer; transition: all 0.15s; }
    .list-tag.selected { background: #c4956a22; border-color: #c4956a; color: #c4956a; }
    .list-tag:hover { border-color: #555; }
    button { width: 100%; padding: 0.85rem; margin-top: 1.75rem; background: #c4956a; color: #0f0f0f; border: none; border-radius: 8px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #d4a57a; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Result page */
    .result { display: none; }
    .result.show { display: block; }
    .form-section.hide { display: none; }
    .success-icon { font-size: 3rem; margin-bottom: 1rem; }
    .key-box { background: #0f0f0f; border: 1px solid #333; border-radius: 8px; padding: 1rem; margin: 1rem 0; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; word-break: break-all; position: relative; }
    .key-box .copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: #333; border: none; color: #e8e4df; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
    .key-box .copy-btn:hover { background: #444; }
    .step { margin-top: 1.5rem; }
    .step-num { display: inline-block; background: #c4956a; color: #0f0f0f; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 0.8rem; font-weight: 700; margin-right: 0.5rem; }
    .step-title { font-weight: 600; font-size: 1rem; }
    .step-desc { color: #a09a93; margin-top: 0.35rem; font-size: 0.9rem; }
    .claude-box { background: #1a1200; border: 1px solid #3a3000; border-radius: 8px; padding: 1rem; margin: 0.75rem 0; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; position: relative; line-height: 1.5; }
    .claude-box .copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: #3a3000; border: none; color: #e8e4df; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Cortex</div>
    <div class="subtitle">Set up your AI Chief of Staff</div>

    <div class="card form-section" id="formSection">
      <label for="name">Your name</label>
      <input type="text" id="name" placeholder="e.g. Dordi Blekken" autofocus>

      <label>Your life domains</label>
      <p class="hint">Click to select which lists to create. You can always add more later.</p>
      <div class="lists-grid" id="listsGrid"></div>

      <label for="customList">Add a custom list</label>
      <input type="text" id="customList" placeholder="e.g. Ulstein-OS">
      <p class="hint">Press Enter to add</p>

      <button id="setupBtn" onclick="doSetup()">Create My Cortex</button>
    </div>

    <div class="card result" id="resultSection">
      <div class="success-icon">&#10003;</div>
      <h2 style="margin-bottom: 0.5rem;">You're all set, <span id="userName"></span>!</h2>
      <p class="hint">Your Cortex is live. Here's how to connect it to Claude.</p>

      <div class="step">
        <span class="step-num">1</span>
        <span class="step-title">Save your API key</span>
        <div class="step-desc">This is shown only once. Save it somewhere safe.</div>
        <div class="key-box" id="apiKeyBox">
          <button class="copy-btn" onclick="copyText('apiKeyBox')">Copy</button>
        </div>
      </div>

      <div class="step">
        <span class="step-num">2</span>
        <span class="step-title">Connect to Claude.ai</span>
        <div class="step-desc">Go to <strong>claude.ai</strong> &rarr; Settings &rarr; Profile &rarr; Custom Instructions. Paste this:</div>
        <div class="claude-box" id="claudeBox">
          <button class="copy-btn" onclick="copyText('claudeBox')">Copy</button>
        </div>
      </div>

      <div class="step">
        <span class="step-num">3</span>
        <span class="step-title">Start a conversation</span>
        <div class="step-desc">Open a new Claude chat. It will automatically know your name and have access to your Cortex. Say "hi" and see the magic.</div>
      </div>
    </div>
  </div>

  <script>
    const DEFAULT_LISTS = ['Work', 'Personal', 'Health', 'Finance', 'Home', 'Travel'];
    const selectedLists = new Set(DEFAULT_LISTS);

    // Render list tags
    function renderLists() {
      const grid = document.getElementById('listsGrid');
      grid.innerHTML = '';
      [...selectedLists].forEach(name => {
        const tag = document.createElement('div');
        tag.className = 'list-tag selected';
        tag.textContent = name;
        tag.onclick = () => {
          if (selectedLists.has(name) && !DEFAULT_LISTS.includes(name)) {
            selectedLists.delete(name);
          } else if (selectedLists.has(name)) {
            selectedLists.delete(name);
          } else {
            selectedLists.add(name);
          }
          renderLists();
        };
        if (selectedLists.has(name)) tag.classList.add('selected');
        else tag.classList.remove('selected');
        grid.appendChild(tag);
      });
    }
    renderLists();

    // Custom list input
    document.getElementById('customList').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val && !selectedLists.has(val)) {
          selectedLists.add(val);
          renderLists();
          e.target.value = '';
        }
      }
    });

    async function doSetup() {
      const name = document.getElementById('name').value.trim();
      if (!name) { alert('Please enter your name'); return; }

      const btn = document.getElementById('setupBtn');
      btn.disabled = true;
      btn.textContent = 'Setting up...';

      try {
        const res = await fetch('/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, lists: [...selectedLists] }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Setup failed');
          btn.disabled = false;
          btn.textContent = 'Create My Cortex';
          return;
        }

        // Show result
        document.getElementById('formSection').classList.add('hide');
        document.getElementById('resultSection').classList.add('show');
        document.getElementById('userName').textContent = name;

        const keyBox = document.getElementById('apiKeyBox');
        keyBox.insertBefore(document.createTextNode(data.apiKey), keyBox.firstChild);

        const claudeBox = document.getElementById('claudeBox');
        claudeBox.insertBefore(document.createTextNode(data.claudeInstructions), claudeBox.firstChild);

      } catch (err) {
        alert('Connection error. Is the server running?');
        btn.disabled = false;
        btn.textContent = 'Create My Cortex';
      }
    }

    function copyText(elementId) {
      const el = document.getElementById(elementId);
      const text = el.childNodes[0]?.textContent || el.textContent;
      navigator.clipboard.writeText(text.trim());
      const btn = el.querySelector('.copy-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    }
  </script>
</body>
</html>`;
}

function alreadyConfiguredPage(userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex — Already Configured</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e8e4df; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 560px; width: 100%; padding: 2rem; text-align: center; }
    .logo { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 2rem; }
    .check { font-size: 3rem; margin-bottom: 1rem; }
    p { color: #a09a93; margin-top: 0.75rem; line-height: 1.5; }
    a { color: #c4956a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Cortex</div>
    <div class="card">
      <div class="check">&#10003;</div>
      <h2>Already configured for ${userName}</h2>
      <p>This Cortex instance is already set up. If you need a new API key, use the <a href="/api/schema">/api/schema</a> endpoint to see available key management endpoints.</p>
      <p style="margin-top: 1.5rem; font-size: 0.85rem;">Need to reset? Delete all documents in the <code>users</code> collection in Firestore, then reload this page.</p>
    </div>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex — Error</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f0f0f; color: #e8e4df; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 500px; padding: 2rem; text-align: center; }
    h2 { color: #e85d4a; margin-bottom: 1rem; }
    p { color: #a09a93; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Setup Error</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
