# Discovery Session Guide

After setting up Cortex, run a **discovery session** — a structured conversation where the AI learns about you. This seeds your memory system so that future conversations have rich context from day one.

---

## How to Run a Discovery Session

1. Open Claude.ai (or your preferred AI)
2. Make sure Cortex is connected (bootstrap should load automatically)
3. Say: **"Let's do a discovery session. I want you to learn about me and save everything as memories."**
4. The AI will ask you questions. Answer naturally — it will save memories as you go.

---

## Suggested Topics

### About You (Identity)
- What's your name and role?
- What company do you work for? What do they do?
- What are your main responsibilities?
- What are you working on right now?

### Your Preferences
- How do you like to communicate? (concise vs. detailed, formal vs. casual)
- What language do you work in? (English, Norwegian, etc.)
- Any travel preferences? (direct flights, hotel chains, etc.)
- Morning person or night owl?

### Your Work Context
- Who are your key clients or stakeholders?
- What projects are active right now?
- What are your biggest priorities this quarter?
- Any upcoming deadlines or events?

### Your Relationships
- Who do you work with most closely?
- Any important contacts the AI should know about?
- Key partners, vendors, or collaborators?

### Your Life Domains
- What are the main areas of your life you want to track?
- Work, Health, Finance, Home, Travel — what matters most?
- Any hobbies or side projects?

---

## Tips for a Great Discovery Session

- **Be specific** — "I manage 12 client accounts at Ulstein Digital" is better than "I work in sales"
- **Include context** — "Client X prefers email over calls" helps the AI be useful later
- **Mention relationships** — "Cesar is my partner, we share Home and Travel domains"
- **State preferences clearly** — "I always want direct flights because I get motion sickness"
- **Cover decisions** — "We decided to use Google Workspace, not Microsoft 365"

---

## What Gets Saved

Each piece of information becomes a **memory** with:
- **Content** — the actual fact (self-contained, atomic)
- **Category** — identity, preference, decision, context, or learning
- **Domain** — which life area it belongs to (work, health, etc.)
- **Confidence** — how certain the AI is (0-1)

---

## After the Session

Check your memories: ask the AI "show me all my memories" or call:
```
GET /api/memories?key=YOUR_KEY
```

You should have 20-50 memories covering who you are, what you do, and what matters to you. Every future conversation will load these automatically via bootstrap.

---

## Monthly Refresh

Once a month, do a quick refresh:
- "Review my memories and flag anything outdated"
- "What new things have you learned about me recently?"
- "Save a memory: [new fact about your life]"

Memories compound. The more context Cortex has, the more useful every conversation becomes.
