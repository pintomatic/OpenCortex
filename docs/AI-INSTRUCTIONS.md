# Connecting Cortex to Claude

After running `/setup`, you'll get instructions to paste into Claude. Here's how to set it up.

---

## Claude.ai (Recommended)

1. Go to [claude.ai](https://claude.ai)
2. Click your name (bottom-left) → **Settings** → **Profile**
3. In **"Custom Instructions"**, paste the text from your setup page:

```
At the start of every conversation, call this URL to load my context:
curl -s "https://YOUR-CLOUD-RUN-URL/api/bootstrap?key=YOUR_API_KEY"
Parse the JSON response. Follow the instructions field. Use the API endpoints listed to help me.
```

4. Click **Save**
5. Start a new conversation — Claude will automatically load your context

---

## Claude Code (CLI)

Add to your `CLAUDE.md` or project instructions:

```
## Cortex Bootstrap
At conversation start, run:
curl -s "https://YOUR-CLOUD-RUN-URL/api/bootstrap?key=YOUR_API_KEY"
Follow the instructions in the JSON response.
```

---

## API Examples

```bash
# Get full context
curl -s "https://YOUR-URL/api/bootstrap?key=YOUR_KEY"

# See all available endpoints
curl -s "https://YOUR-URL/api/schema"

# Create a memory
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":"I prefer morning meetings","category":"preference","domain":"work"}' \
  "https://YOUR-URL/api/memories?key=YOUR_KEY"

# Create a task
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Follow up with client","listName":"Work","dueDate":"2026-03-01"}' \
  "https://YOUR-URL/api/tasks?key=YOUR_KEY"
```

---

## Tips

- **Bootstrap runs at the start of every conversation** — Claude will always know your latest context
- **Save memories during conversations** — when Claude learns something new about you, ask it to save it as a memory
- **Use task lists** — organize tasks into life domains (Work, Personal, Health, etc.)
- **Meeting prep** — before any meeting, ask Claude to prepare using `/api/meeting-prep/:contactId`
- **The more you use it, the better it gets** — memories compound over time
