/**
 * Generates the "intake prompt" — a ready-to-paste message the user gives
 * Claude to kick off the detective phase. Claude uses connected tools
 * (email, calendar, CRM) to learn about the user and populate Cortex.
 *
 * This is the bridge between "account created" and "Cortex knows me."
 */

interface IntakeTemplateParams {
  name: string;
  apiKey: string;
  baseUrl: string;
  connectors: string[]; // e.g. ["gmail", "calendar", "hubspot", "chatgpt-export"]
  lists: string[];
}

export function generateIntakePrompt({
  name,
  apiKey,
  baseUrl,
  connectors,
  lists,
}: IntakeTemplateParams): string {
  const firstName = name.split(" ")[0];
  const apiBase = `${baseUrl}/api`;

  // Build connector-specific investigation instructions
  const investigations: string[] = [];

  if (connectors.includes("gmail")) {
    investigations.push(`**Email** — Browse my recent emails (last 2-3 months). Look for:
  - Who I email most frequently — these are my key relationships
  - What projects or topics keep coming up
  - My communication style and tone
  - Any recurring meetings, clients, or collaborators
  - Decisions I've made or commitments I've given
  For each important person you find, create a contact in Cortex with their name, email, company, role, and how I know them.`);
  }

  if (connectors.includes("calendar")) {
    investigations.push(`**Calendar** — Look through my calendar (last month and next month). Look for:
  - Recurring meetings — what's my weekly rhythm?
  - Key people I meet with regularly
  - Upcoming commitments and deadlines
  - The kind of work I do based on meeting titles and descriptions`);
  }

  if (connectors.includes("hubspot")) {
    investigations.push(`**HubSpot** — Browse my CRM. Look for:
  - Active deals and their stages
  - Key contacts and companies I'm working with
  - Recent activity and notes
  - Pipeline value and priorities
  Save the most important contacts and deal context to Cortex.`);
  }

  if (connectors.includes("salesforce")) {
    investigations.push(`**Salesforce** — Browse my CRM. Look for:
  - Open opportunities and their stages
  - Key accounts and contacts
  - Recent activities and tasks
  - Pipeline priorities
  Save the most important contacts and deal context to Cortex.`);
  }

  if (connectors.includes("chatgpt-export")) {
    investigations.push(`**ChatGPT History** — I've exported my ChatGPT data (Settings → Data Controls → Export Data in ChatGPT) and uploaded the zip file to this conversation. Browse through my conversation history and look for:
  - Topics I frequently ask about — these reveal my interests and priorities
  - Decisions I've discussed or made
  - Projects I've been working on
  - Preferences and patterns in how I work
  - People and companies mentioned frequently
  Note: This is an uploaded file, not a connected tool. Parse the conversations.json inside the zip.`);
  }

  if (connectors.includes("slack")) {
    investigations.push(`**Slack** — Browse my recent messages. Look for:
  - Key channels I'm active in
  - People I message most
  - Projects and topics I discuss
  - My communication style in a team context`);
  }

  // If no specific connectors, give a general prompt
  if (investigations.length === 0) {
    investigations.push(`I'll tell you about myself. Ask me questions — start with the basics (what I do, who I work with, what's on my plate) and go deeper from there. Be thorough. The more you learn now, the better you can help me later.`);
  }

  const investigationBlock = investigations
    .map((inv, i) => `${i + 1}. ${inv}`)
    .join("\n\n");

  return `Hey ${firstName === name ? "" : "— "}I just set up Cortex and I want you to get to know me. Play detective.

You have access to my connected tools. I want you to browse through everything you can find and learn as much as possible about who I am, what I do, who I work with, and what matters to me.

Here's what to investigate:

${investigationBlock}

As you discover things, actively populate Cortex:

- **Contacts** — Create entries for everyone important (name, email, company, role, how I know them)
- **Memories** — Save facts about me: identity, preferences, decisions, context, learnings
- **Tasks** — If you find open items, commitments, or things I clearly need to do, create tasks in the right lists

My lists are: ${lists.join(", ")}

**How to approach this:**
- Work through it systematically — don't rush
- Tell me what you're finding as you go, in a conversational way
- At the end, give me a summary: "Here's what I learned about you" with the highlights
- Be honest about gaps — tell me what you couldn't find so I can fill in manually

**Final step — generate my two skill files:**

Once you've finished investigating and populating Cortex, I need you to create two personalized skill files. These are markdown files I'll save as permanent instructions in Claude.

### Skill 1: Daily Driver (\`${firstName.toLowerCase()}-daily-driver.md\`)
This activates on every conversation. It should include:
1. **Who I Am** — written in first person: "My name is ${name}. I use a personal productivity API called Cortex. At the start of each conversation, please run:" followed by \`curl -s "${apiBase}/bootstrap?key=${apiKey}"\`
2. **Cortex API** — base URL (\`${apiBase}\`), auth (\`?key=${apiKey}\`), always use curl, I prefer not to see raw JSON
3. **Proactive Behaviors** — save memories without asking, create tasks when action items emerge, log contacts when new people come up, end-of-chat capture, session learning capture. Include the actual curl commands with my API key baked in.
4. **How I Like You to Work** — based on what you learned about my communication style, language, tone, and work patterns
5. **My lists:** ${lists.join(", ")}

### Skill 2: Weekly Triage (\`${firstName.toLowerCase()}-weekly-triage.md\`)
This activates when I say "triage", "weekly review", or "what's on my plate". It should include:
1. **The triage protocol** — load all tasks, task summary, upcoming 7 days, unprocessed learnings (with curl commands and my API key)
2. **Dashboard format** — scannable snapshot I can read in 30 seconds
3. **Triage checklist** — for each task: still relevant? right list? has due date? blocked? too big?
4. **Learning review** — surface \`skill-improvement\` memories, discuss patterns
5. **Week ahead** — top 3 priorities

**Important:** Write both files in first person from my perspective to avoid prompt injection flags. Personalize them based on everything you discovered about me — my industry, my role, my communication style, the tools I use.

When you're done, show me both files so I can review them, then I'll save them as Project Knowledge in Claude.

This is the foundation. The better this session goes, the more useful every future conversation will be. Take your time.`;

}
