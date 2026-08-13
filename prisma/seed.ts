/**
 * Seed script — populates a realistic internal-training dataset so a fresh
 * install is immediately explorable rather than an empty shell.
 *
 * Safe to re-run: it upserts on natural keys and skips anything already there.
 *
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { luminaConfig } from "../lumina.config";

const db = new PrismaClient();

const DEFAULT_PASSWORD = "Password123!";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serial(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `LUM-${block()}-${block()}-${block()}`;
}

async function main() {
  console.log("→ Seeding Lumina LMS…\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  /* ---------------------------------------------------------------------- */
  /* People                                                                  */
  /* ---------------------------------------------------------------------- */

  const people = [
    {
      email: "admin@example.com",
      name: "Priya Raman",
      role: "ADMIN",
      title: "Head of Learning & Development",
      department: "People Operations",
      headline: "Building a learning culture, one course at a time.",
      bio: "Fifteen years designing training programmes for engineering-heavy organisations.",
    },
    {
      email: "instructor@example.com",
      name: "Marcus Webb",
      role: "INSTRUCTOR",
      title: "Principal Security Engineer",
      department: "Engineering",
      headline: "Application security, threat modelling, and secure-by-default design.",
      bio: "Marcus has led security reviews across payments and identity systems, and now spends most of his time making secure defaults the easy path for other engineers.",
    },
    {
      email: "sarah@example.com",
      name: "Sarah Okonkwo",
      role: "INSTRUCTOR",
      title: "Director of Product Design",
      department: "Product & Design",
      headline: "Design systems, accessibility, and research practice.",
      bio: "Sarah runs the design practice and has shipped design systems used by several hundred engineers.",
    },
    {
      email: "learner@example.com",
      name: "Daniel Ortiz",
      role: "LEARNER",
      title: "Software Engineer",
      department: "Engineering",
    },
    {
      email: "amara@example.com",
      name: "Amara Bello",
      role: "LEARNER",
      title: "Data Analyst",
      department: "Data & Analytics",
    },
    {
      email: "kenji@example.com",
      name: "Kenji Tanaka",
      role: "LEARNER",
      title: "Product Manager",
      department: "Product & Design",
    },
    {
      email: "lena@example.com",
      name: "Lena Fischer",
      role: "LEARNER",
      title: "Account Executive",
      department: "Sales & Marketing",
    },
    {
      email: "omar@example.com",
      name: "Omar Haddad",
      role: "LEARNER",
      title: "Site Reliability Engineer",
      department: "Engineering",
    },
    {
      email: "chloe@example.com",
      name: "Chloé Martin",
      role: "LEARNER",
      title: "People Partner",
      department: "People Operations",
    },
    {
      email: "raj@example.com",
      name: "Raj Patel",
      role: "LEARNER",
      title: "Engineering Manager",
      department: "Engineering",
    },
  ] as const;

  const users: Record<string, string> = {};

  for (const person of people) {
    const user = await db.user.upsert({
      where: { email: person.email },
      update: {},
      create: {
        email: person.email,
        name: person.name,
        passwordHash,
        role: person.role,
        title: person.title,
        department: person.department,
        headline: "headline" in person ? person.headline : null,
        bio: "bio" in person ? person.bio : null,
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });
    users[person.email] = user.id;
  }
  console.log(`  ✓ ${people.length} people`);

  /* ---------------------------------------------------------------------- */
  /* Categories                                                              */
  /* ---------------------------------------------------------------------- */

  const categories: Record<string, string> = {};

  for (const [index, category] of luminaConfig.catalog.defaultCategories.entries()) {
    const record = await db.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        slug: slugify(category.name),
        icon: category.icon,
        color: category.color,
        order: index,
      },
      select: { id: true },
    });
    categories[category.name] = record.id;
  }
  console.log(`  ✓ ${luminaConfig.catalog.defaultCategories.length} categories`);

  /* ---------------------------------------------------------------------- */
  /* Courses                                                                 */
  /* ---------------------------------------------------------------------- */

  interface SeedLesson {
    title: string;
    type: "VIDEO" | "ARTICLE" | "QUIZ" | "RESOURCE";
    minutes?: number;
    summary?: string;
    body?: string;
    isPreview?: boolean;
    questions?: {
      prompt: string;
      type: "SINGLE" | "MULTI" | "TRUE_FALSE";
      explanation?: string;
      options: { text: string; correct?: boolean }[];
    }[];
  }

  interface SeedCourse {
    title: string;
    subtitle: string;
    description: string;
    category: string;
    instructor: string;
    level: string;
    isMandatory?: boolean;
    objectives: string[];
    requirements: string[];
    audience: string[];
    tags: string[];
    sections: { title: string; lessons: SeedLesson[] }[];
  }

  const seedCourses: SeedCourse[] = [
    {
      title: "Your First 30 Days",
      subtitle: "Everything you need to know to hit the ground running.",
      description:
        "A guided tour of how we work: the tools, the rituals, the people, and the unwritten rules nobody thinks to tell you. Built for anyone in their first month, and worth a skim even if you've been here a while.",
      category: "Onboarding",
      instructor: "admin@example.com",
      level: "Beginner",
      isMandatory: true,
      objectives: [
        "Navigate the tools and systems you'll use every day",
        "Understand how teams are organised and who to ask for what",
        "Know what's expected in your first, second, and fourth week",
        "Find the policies and benefits information you need",
      ],
      requirements: ["No prior knowledge — this is day one material"],
      audience: ["Every new joiner", "Managers onboarding someone new"],
      tags: ["onboarding", "culture", "getting started"],
      sections: [
        {
          title: "Welcome",
          lessons: [
            {
              title: "Who we are and what we're building",
              type: "VIDEO",
              minutes: 8,
              isPreview: true,
              summary: "A short introduction from the leadership team.",
            },
            {
              title: "How we work: rituals and rhythms",
              type: "ARTICLE",
              minutes: 6,
              body: `# How we work

Our week has a predictable shape. Knowing it makes everything else easier.

## Monday — planning
Teams set intent for the week. Keep it to the two or three things that actually matter.

## Wednesday — demos
Anyone can show anything. Half-finished is welcome; polish is not the point.

## Friday — retro and wind-down
What worked, what didn't, what we're changing. Short, honest, blameless.

## Asynchronous by default
Most communication happens in writing. Meetings are for decisions that genuinely need a conversation, not for status updates.

If you're unsure whether something warrants a meeting, write it up first. Nine times in ten, the writing is enough.`,
            },
            {
              title: "Your first week checklist",
              type: "ARTICLE",
              minutes: 4,
              body: `# First week checklist

- [ ] Set up your development environment
- [ ] Join your team's channels
- [ ] Meet your onboarding buddy
- [ ] Read your team's charter document
- [ ] Ship something small — a typo fix counts
- [ ] Book a 1:1 with your manager
- [ ] Complete required compliance training

Nobody expects you to be productive in week one. They expect you to ask questions.`,
            },
          ],
        },
        {
          title: "Tools and access",
          lessons: [
            {
              title: "Setting up your environment",
              type: "VIDEO",
              minutes: 14,
              summary: "Walkthrough of the standard developer setup.",
            },
            {
              title: "Getting the right access",
              type: "ARTICLE",
              minutes: 5,
              body: `# Access requests

Access is granted on a least-privilege basis. You'll start with what your role needs and can request more as you go.

Request access through the internal service portal. Most requests are approved within a business day; anything touching production data needs your manager's sign-off.

If you're blocked waiting on access, say so in your team channel rather than sitting on it.`,
            },
            {
              title: "Onboarding knowledge check",
              type: "QUIZ",
              minutes: 5,
              questions: [
                {
                  prompt: "What is the default expectation for team communication?",
                  type: "SINGLE",
                  explanation:
                    "Writing scales across time zones and creates a searchable record. Meetings are reserved for genuine two-way decisions.",
                  options: [
                    { text: "Asynchronous and in writing", correct: true },
                    { text: "Daily stand-up meetings" },
                    { text: "Direct messages to your manager" },
                    { text: "Whatever your team prefers" },
                  ],
                },
                {
                  prompt: "Which of these are part of the first week checklist?",
                  type: "MULTI",
                  explanation:
                    "All four are on the list. Shipping something small early builds confidence with the tooling.",
                  options: [
                    { text: "Set up your development environment", correct: true },
                    { text: "Meet your onboarding buddy", correct: true },
                    { text: "Ship something small", correct: true },
                    { text: "Complete required compliance training", correct: true },
                  ],
                },
                {
                  prompt: "Access is granted on a least-privilege basis.",
                  type: "TRUE_FALSE",
                  explanation:
                    "You start with what your role needs and request more as the work demands it.",
                  options: [
                    { text: "True", correct: true },
                    { text: "False" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      title: "Secure Coding Fundamentals",
      subtitle: "Write code that doesn't become tomorrow's incident report.",
      description:
        "The vulnerability classes that actually show up in code review, why they happen, and the defaults that make them hard to write in the first place. Practical rather than theoretical — every section ends with something you can apply the same afternoon.",
      category: "Engineering",
      instructor: "instructor@example.com",
      level: "Intermediate",
      isMandatory: true,
      objectives: [
        "Recognise the OWASP Top 10 in real code, not just in slides",
        "Write parameterised queries and safe templating by default",
        "Reason about trust boundaries in a service you're designing",
        "Run and interpret the security tooling in our CI pipeline",
      ],
      requirements: [
        "Comfortable reading code in at least one mainstream language",
        "Basic understanding of HTTP and how web requests flow",
      ],
      audience: [
        "Backend and full-stack engineers",
        "Anyone who reviews code",
        "Engineering managers who want to ask better questions",
      ],
      tags: ["security", "owasp", "code review", "engineering"],
      sections: [
        {
          title: "The shape of the problem",
          lessons: [
            {
              title: "Why secure code is a design problem",
              type: "VIDEO",
              minutes: 12,
              isPreview: true,
              summary: "Most vulnerabilities are design decisions that hardened over time.",
            },
            {
              title: "Trust boundaries and where they break",
              type: "ARTICLE",
              minutes: 9,
              body: `# Trust boundaries

A trust boundary is any point where data crosses from somewhere you control to somewhere you don't — or the reverse.

## The three questions

For every input crossing a boundary, ask:

1. **Where did this come from?** User, another service, a queue, a file on disk.
2. **What am I about to do with it?** Interpolate into a query, render into HTML, pass to a shell.
3. **What's the worst thing it could be?** Not the worst thing you expect — the worst thing that's *possible*.

## Validation is not sanitisation

Validation rejects bad input. Sanitisation transforms it. They solve different problems and neither substitutes for context-appropriate encoding at the point of use.

The single highest-leverage habit: **encode at the point of use, not at the point of entry.** A string that's safe in HTML is not safe in a SQL query, and vice versa.`,
            },
          ],
        },
        {
          title: "Injection",
          lessons: [
            {
              title: "SQL injection in practice",
              type: "VIDEO",
              minutes: 18,
              summary: "Live walkthrough of an injection and the one-line fix.",
            },
            {
              title: "Parameterised queries everywhere",
              type: "ARTICLE",
              minutes: 7,
              body: `# Parameterise everything

String concatenation into a query is the bug. Parameterisation is the fix, and it is almost always available.

\`\`\`js
// Wrong — the input becomes part of the query structure
db.query("SELECT * FROM users WHERE email = '" + email + "'");

// Right — the input can only ever be a value
db.query("SELECT * FROM users WHERE email = $1", [email]);
\`\`\`

## What about dynamic table names?

Parameterisation covers values, not identifiers. If you genuinely need a dynamic table or column name, validate it against an allowlist you control — never against a pattern.

\`\`\`js
const ALLOWED_SORTS = ["created_at", "name", "email"];
if (!ALLOWED_SORTS.includes(sortColumn)) throw new Error("Invalid sort");
\`\`\``,
            },
            {
              title: "Injection knowledge check",
              type: "QUIZ",
              minutes: 6,
              questions: [
                {
                  prompt: "Which approach reliably prevents SQL injection?",
                  type: "SINGLE",
                  explanation:
                    "Parameterisation keeps user data as data — it can never become part of the query structure, regardless of content.",
                  options: [
                    { text: "Parameterised queries with bound values", correct: true },
                    { text: "Escaping single quotes in the input" },
                    { text: "Rejecting inputs containing SQL keywords" },
                    { text: "Limiting input length to 100 characters" },
                  ],
                },
                {
                  prompt: "When should output encoding be applied?",
                  type: "SINGLE",
                  explanation:
                    "The same string needs different encoding for HTML, SQL, and shell contexts. Encoding at entry picks one context and gets the others wrong.",
                  options: [
                    { text: "At the point of use, in the target context", correct: true },
                    { text: "At the point of entry, once" },
                    { text: "In a middleware layer for all requests" },
                    { text: "Only for inputs from untrusted users" },
                  ],
                },
                {
                  prompt: "Parameterised queries also protect dynamic table names.",
                  type: "TRUE_FALSE",
                  explanation:
                    "Parameters bind values, not identifiers. Dynamic identifiers need an allowlist you control.",
                  options: [
                    { text: "True" },
                    { text: "False", correct: true },
                  ],
                },
              ],
            },
          ],
        },
        {
          title: "Secrets and dependencies",
          lessons: [
            {
              title: "Secrets management",
              type: "VIDEO",
              minutes: 15,
              summary: "Where secrets should live, and how they leak.",
            },
            {
              title: "Dependency hygiene",
              type: "ARTICLE",
              minutes: 8,
              body: `# Dependencies

Your dependency tree is your attack surface. A few habits keep it manageable.

## Pin and review

Lockfiles are not optional. Review dependency updates the same way you review code — especially minor bumps in packages that touch auth, crypto, or serialisation.

## Prefer fewer, larger dependencies

A well-maintained framework beats fifteen micro-packages with one maintainer each.

## Watch for install scripts

A package that runs code at install time has already executed on your machine and in CI before any of your tests ran.`,
            },
            {
              title: "Secure coding checklist (PDF)",
              type: "RESOURCE",
              summary: "One-page reference to keep next to your review queue.",
            },
          ],
        },
      ],
    },

    {
      title: "Design Systems That Scale",
      subtitle: "From component library to shared language.",
      description:
        "Design systems fail for organisational reasons far more often than technical ones. This course covers both: the tokens, components, and documentation, plus the governance that keeps a system alive after its founding team moves on.",
      category: "Product & Design",
      instructor: "sarah@example.com",
      level: "Intermediate",
      objectives: [
        "Structure design tokens so themes and brands are a configuration change",
        "Decide what belongs in the system and what stays in product code",
        "Write component documentation people actually read",
        "Set up contribution and deprecation processes that survive turnover",
      ],
      requirements: [
        "Some experience building or consuming a component library",
      ],
      audience: [
        "Product designers",
        "Front-end engineers",
        "Anyone maintaining shared UI code",
      ],
      tags: ["design systems", "tokens", "accessibility", "components"],
      sections: [
        {
          title: "Foundations",
          lessons: [
            {
              title: "What a design system actually is",
              type: "VIDEO",
              minutes: 11,
              isPreview: true,
              summary: "It's not a component library. It's an agreement.",
            },
            {
              title: "Token architecture",
              type: "ARTICLE",
              minutes: 10,
              body: `# Token architecture

Three tiers, and the discipline to keep them separate.

## Tier 1 — primitives

Raw values with no meaning attached. \`blue-500\`, \`space-4\`, \`radius-lg\`. Nothing in product code should reference these directly.

## Tier 2 — semantic

Meaning, not appearance. \`color-surface\`, \`color-text-primary\`, \`space-inline-sm\`. This is the layer products consume.

## Tier 3 — component

Scoped overrides where a component genuinely needs to diverge. \`button-primary-background\`. Use sparingly — every entry here is a small failure of tier 2.

## Why the separation matters

Dark mode, high-contrast mode, and white-labelling are all the same problem: remapping tier 2 onto different tier 1 values. If products reference primitives directly, none of that works.`,
            },
          ],
        },
        {
          title: "Governance",
          lessons: [
            {
              title: "Contribution models that work",
              type: "VIDEO",
              minutes: 16,
              summary: "Centralised, federated, and the hybrid most teams land on.",
            },
            {
              title: "Deprecating without breaking everyone",
              type: "ARTICLE",
              minutes: 7,
              body: `# Deprecation

A design system that can never remove anything will collapse under its own weight.

## The three-stage path

1. **Announce.** Mark deprecated in the docs and emit a console warning in development. Say what to use instead.
2. **Migrate.** Ship a codemod if you can. Offer to do the migration for the two or three teams with the heaviest usage.
3. **Remove.** On a major version, with the migration path documented.

Never skip stage two. A deprecation notice with no migration path is just a complaint.`,
            },
          ],
        },
      ],
    },

    {
      title: "Data Storytelling for Analysts",
      subtitle: "Make the number land, not just appear.",
      description:
        "A well-chosen chart changes a decision. A badly chosen one gets ignored, or worse, misleads. This course is about the reasoning behind chart selection, colour, and narrative structure — and about knowing when the honest answer is 'the data doesn't say'.",
      category: "Data & Analytics",
      instructor: "sarah@example.com",
      level: "Beginner",
      objectives: [
        "Pick a chart form from the question, not from habit",
        "Use colour to encode meaning rather than decorate",
        "Structure an analysis so the conclusion arrives before the method",
        "Recognise and avoid the common ways charts mislead",
      ],
      requirements: ["Comfort with spreadsheets or a BI tool"],
      audience: ["Analysts", "Product managers", "Anyone who presents numbers"],
      tags: ["data", "visualisation", "communication", "analytics"],
      sections: [
        {
          title: "Choosing the form",
          lessons: [
            {
              title: "The question determines the chart",
              type: "VIDEO",
              minutes: 13,
              isPreview: true,
              summary: "Comparison, composition, distribution, relationship, trend.",
            },
            {
              title: "When not to use a chart",
              type: "ARTICLE",
              minutes: 5,
              body: `# When a chart is the wrong answer

## One number

If the finding is a single number, write the number. A chart with one bar is a number wearing a costume.

## Three numbers

A sentence usually beats a chart: "Retention held at 82%, up from 79% last quarter and 74% the quarter before."

## Precise comparison

If readers need to compare exact values, a table is more honest than a chart. Charts are for shape and relationship; tables are for lookup.

## The rule of thumb

Reach for a chart when the *shape* of the data carries the message. Reach for text or a table when the *values* do.`,
            },
            {
              title: "Chart selection quiz",
              type: "QUIZ",
              minutes: 5,
              questions: [
                {
                  prompt:
                    "You need to show how a single metric changed over 24 months. What's the default form?",
                  type: "SINGLE",
                  explanation:
                    "A line chart makes trend and rate of change legible, which is what a time-series question is asking about.",
                  options: [
                    { text: "Line chart", correct: true },
                    { text: "Pie chart" },
                    { text: "Stacked bar chart" },
                    { text: "Scatter plot" },
                  ],
                },
                {
                  prompt: "Which of these are good reasons to use a table instead of a chart?",
                  type: "MULTI",
                  explanation:
                    "Tables win when readers need exact values or the dataset is small enough to read directly.",
                  options: [
                    { text: "Readers need to look up precise values", correct: true },
                    { text: "There are only three numbers", correct: true },
                    { text: "The data has a striking shape" },
                    { text: "You want to show a correlation" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      title: "Workplace Conduct & Compliance",
      subtitle: "The policies everyone is required to know.",
      description:
        "Annual compliance training covering our code of conduct, anti-harassment policy, data protection obligations, and how to raise a concern. Required for all staff, refreshed yearly.",
      category: "Compliance & Safety",
      instructor: "admin@example.com",
      level: "All Levels",
      isMandatory: true,
      objectives: [
        "Know what the code of conduct requires of you",
        "Recognise harassment and understand your reporting options",
        "Handle personal data in line with our obligations",
        "Know how to raise a concern, including anonymously",
      ],
      requirements: [],
      audience: ["All staff — this is mandatory annual training"],
      tags: ["compliance", "conduct", "policy", "required"],
      sections: [
        {
          title: "Code of conduct",
          lessons: [
            {
              title: "Our standards",
              type: "VIDEO",
              minutes: 10,
              isPreview: true,
              summary: "What we expect from each other, in plain terms.",
            },
            {
              title: "Raising a concern",
              type: "ARTICLE",
              minutes: 6,
              body: `# Raising a concern

You have several routes, and you can use whichever you're most comfortable with.

## Your manager

The fastest route for most issues. If the concern involves your manager, skip to any of the options below.

## People Operations

Reach out directly. Conversations are treated as confidential unless there's a legal obligation to act, which will be explained to you before anything is escalated.

## Anonymous reporting

The reporting line accepts anonymous submissions. They are investigated with the same seriousness as named reports, though anonymity can limit how much follow-up is possible.

## Non-retaliation

Retaliation against anyone who raises a concern in good faith is itself a serious breach of this policy. This holds even if the original concern turns out to be unfounded.`,
            },
          ],
        },
        {
          title: "Data protection",
          lessons: [
            {
              title: "Handling personal data",
              type: "VIDEO",
              minutes: 12,
              summary: "What counts as personal data, and your obligations around it.",
            },
            {
              title: "Compliance assessment",
              type: "QUIZ",
              minutes: 8,
              questions: [
                {
                  prompt: "Retaliation against someone who raises a good-faith concern is:",
                  type: "SINGLE",
                  explanation:
                    "Non-retaliation is absolute and applies even when the original concern is not substantiated.",
                  options: [
                    {
                      text: "A serious breach of policy, regardless of the outcome of the original concern",
                      correct: true,
                    },
                    { text: "Acceptable if the concern was unfounded" },
                    { text: "A matter for the individuals to resolve privately" },
                    { text: "Only an issue if it is repeated" },
                  ],
                },
                {
                  prompt: "Which routes are available for raising a concern?",
                  type: "MULTI",
                  explanation: "All three are valid, and you may use whichever you prefer.",
                  options: [
                    { text: "Your manager", correct: true },
                    { text: "People Operations directly", correct: true },
                    { text: "The anonymous reporting line", correct: true },
                    { text: "Only through your manager" },
                  ],
                },
                {
                  prompt: "Anonymous reports are investigated less seriously than named ones.",
                  type: "TRUE_FALSE",
                  explanation:
                    "They get the same seriousness. Anonymity can limit follow-up, but not the investigation's rigour.",
                  options: [
                    { text: "True" },
                    { text: "False", correct: true },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      title: "Leading Your First Team",
      subtitle: "The transition from doing the work to enabling it.",
      description:
        "Becoming a manager is a career change, not a promotion. This course covers the shift honestly: the skills that stop being useful, the ones you have to build, and the mistakes almost everyone makes in the first six months.",
      category: "Leadership",
      instructor: "admin@example.com",
      level: "Intermediate",
      objectives: [
        "Run 1:1s that surface problems before they become resignations",
        "Give feedback that changes behaviour without damaging trust",
        "Delegate work you could do faster yourself, and be at peace with it",
        "Recognise and interrupt your own tendency to jump back into the work",
      ],
      requirements: ["Currently managing, or about to start"],
      audience: ["New managers", "Tech leads", "Anyone considering the move"],
      tags: ["leadership", "management", "feedback", "1:1s"],
      sections: [
        {
          title: "The transition",
          lessons: [
            {
              title: "What actually changes",
              type: "VIDEO",
              minutes: 14,
              isPreview: true,
              summary: "Your output is now your team's output. That's harder than it sounds.",
            },
            {
              title: "The 1:1 that earns its slot",
              type: "ARTICLE",
              minutes: 8,
              body: `# One-to-ones

## Whose meeting is it?

Theirs. If you're talking more than a third of the time, something has gone wrong.

## Not a status update

Status belongs in writing. This slot is for the things that don't fit anywhere else: friction, ambiguity, career direction, and the thing they've been meaning to mention for three weeks.

## Three questions that work

- "What's frustrating you right now?"
- "What did you expect to happen this week that didn't?"
- "Is there anything you've been holding back on telling me?"

The third one is uncomfortable to ask and almost always worth it.

## Consistency beats duration

Thirty minutes every week beats an hour every three. Cancelling repeatedly tells people where they sit in your priorities, whatever you say otherwise.`,
            },
          ],
        },
        {
          title: "Feedback",
          lessons: [
            {
              title: "Feedback that lands",
              type: "VIDEO",
              minutes: 17,
              summary: "Specific, timely, and about behaviour rather than character.",
            },
            {
              title: "Management reading list",
              type: "RESOURCE",
              summary: "Books and essays worth your time, with notes on which to read first.",
            },
          ],
        },
      ],
    },

    {
      title: "Async Communication That Works",
      subtitle: "Write so people don't need to ask you follow-up questions.",
      description:
        "Distributed teams live or die by their writing. This short course covers structuring a document so readers find what they need, writing updates people actually read, and knowing when to stop writing and get on a call.",
      category: "Professional Skills",
      instructor: "sarah@example.com",
      level: "Beginner",
      objectives: [
        "Structure a document so readers can skim it and still get the point",
        "Write status updates that respect the reader's time",
        "Recognise the situations where async genuinely fails",
      ],
      requirements: [],
      audience: ["Everyone, but especially anyone new to distributed work"],
      tags: ["communication", "writing", "remote", "async"],
      sections: [
        {
          title: "Writing to be read",
          lessons: [
            {
              title: "Conclusion first",
              type: "VIDEO",
              minutes: 9,
              isPreview: true,
              summary: "Your reader may only read the first paragraph. Plan for that.",
            },
            {
              title: "The shape of a good document",
              type: "ARTICLE",
              minutes: 6,
              body: `# Document structure

## Lead with the answer

Start with what you concluded and what you need from the reader. Method, alternatives, and caveats come after. Academic structure — background, method, results, conclusion — is exactly backwards for workplace writing.

## Make it skimmable

Headings every few paragraphs. Bold the load-bearing sentence. If a section can't be summarised in its heading, the section is doing too much.

## Say what you need

End with a specific ask. "Thoughts?" is not an ask. "I need a yes or no on option B by Thursday" is.

## When async fails

Get on a call when there's genuine disagreement, when the topic is emotionally charged, or when you've been round the loop twice in writing without converging. Writing is the default, not the religion.`,
            },
          ],
        },
      ],
    },

    {
      title: "Consultative Selling",
      subtitle: "Diagnose before you prescribe.",
      description:
        "A practical approach to discovery calls and qualification: how to ask questions that uncover real problems, how to tell a genuine opportunity from a pleasant conversation, and how to walk away from a bad fit early.",
      category: "Sales & Marketing",
      instructor: "admin@example.com",
      level: "Intermediate",
      objectives: [
        "Run a discovery call that surfaces the problem behind the request",
        "Qualify honestly, including qualifying out",
        "Handle objections by understanding them rather than countering them",
      ],
      requirements: ["Some experience in a customer-facing role"],
      audience: ["Account executives", "Solutions engineers", "Founders selling directly"],
      tags: ["sales", "discovery", "qualification"],
      sections: [
        {
          title: "Discovery",
          lessons: [
            {
              title: "Questions that open things up",
              type: "VIDEO",
              minutes: 15,
              isPreview: true,
              summary: "The difference between interrogation and diagnosis.",
            },
            {
              title: "Qualifying out is a skill",
              type: "ARTICLE",
              minutes: 6,
              body: `# Qualifying out

The fastest way to improve a pipeline is to remove the deals that were never going to close.

## Signals worth taking seriously

- No one has named a budget, and nobody seems uncomfortable about that
- You can't identify who signs
- The problem they describe is real but small
- Timeline keeps moving and nothing changes when it does

## Saying it out loud

"Based on what you've described, I don't think we're the right fit — here's what I'd look at instead." This costs you a deal that wasn't real and buys you a reputation that is.

Sales cycles are long. Reputation compounds faster than pipeline.`,
            },
          ],
        },
      ],
    },
  ];

  let courseCount = 0;
  const createdCourses: Record<string, string> = {};

  for (const seed of seedCourses) {
    const slug = slugify(seed.title);

    const existing = await db.course.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      createdCourses[seed.title] = existing.id;
      continue;
    }

    let totalSeconds = 0;
    let lessonTotal = 0;

    const course = await db.course.create({
      data: {
        slug,
        title: seed.title,
        subtitle: seed.subtitle,
        description: seed.description,
        categoryId: categories[seed.category],
        instructorId: users[seed.instructor],
        level: seed.level,
        status: "PUBLISHED",
        publishedAt: new Date(),
        isMandatory: seed.isMandatory ?? false,
        objectives: JSON.stringify(seed.objectives),
        requirements: JSON.stringify(seed.requirements),
        audience: JSON.stringify(seed.audience),
        tags: JSON.stringify(seed.tags),
      },
      select: { id: true },
    });

    for (const [sectionIndex, section] of seed.sections.entries()) {
      const createdSection = await db.section.create({
        data: {
          courseId: course.id,
          title: section.title,
          order: sectionIndex,
        },
        select: { id: true },
      });

      for (const [lessonIndex, lesson] of section.lessons.entries()) {
        const seconds = (lesson.minutes ?? 0) * 60;
        totalSeconds += seconds;
        lessonTotal += 1;

        const createdLesson = await db.lesson.create({
          data: {
            sectionId: createdSection.id,
            title: lesson.title,
            type: lesson.type,
            order: lessonIndex,
            summary: lesson.summary ?? null,
            contentText: lesson.body ?? null,
            durationSeconds: seconds,
            isPreview: lesson.isPreview ?? false,
          },
          select: { id: true },
        });

        for (const [questionIndex, question] of (lesson.questions ?? []).entries()) {
          await db.quizQuestion.create({
            data: {
              lessonId: createdLesson.id,
              prompt: question.prompt,
              type: question.type,
              explanation: question.explanation ?? null,
              points: 1,
              order: questionIndex,
              options: {
                create: question.options.map((option, optionIndex) => ({
                  text: option.text,
                  isCorrect: option.correct ?? false,
                  order: optionIndex,
                })),
              },
            },
          });
        }
      }
    }

    await db.course.update({
      where: { id: course.id },
      data: {
        durationMinutes: Math.round(totalSeconds / 60),
        lessonCount: lessonTotal,
      },
    });

    createdCourses[seed.title] = course.id;
    courseCount += 1;
  }
  console.log(`  ✓ ${courseCount} courses`);

  /* ---------------------------------------------------------------------- */
  /* Learning paths                                                          */
  /* ---------------------------------------------------------------------- */

  const seedPaths = [
    {
      title: "New Engineer Onboarding",
      description:
        "Everything a new engineer needs in their first month, in the order it makes sense to take it.",
      color: "#6366f1",
      courses: ["Your First 30 Days", "Workplace Conduct & Compliance", "Secure Coding Fundamentals"],
    },
    {
      title: "New Manager Track",
      description:
        "For anyone stepping into their first people-management role. Take these in order over your first quarter.",
      color: "#f59e0b",
      courses: ["Leading Your First Team", "Async Communication That Works"],
    },
    {
      title: "Product & Design Craft",
      description:
        "Deepen your practice across design systems and how you communicate findings.",
      color: "#ec4899",
      courses: ["Design Systems That Scale", "Data Storytelling for Analysts"],
    },
  ];

  let pathCount = 0;
  const createdPaths: Record<string, string> = {};

  for (const seed of seedPaths) {
    const slug = slugify(seed.title);
    const existing = await db.learningPath.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      createdPaths[seed.title] = existing.id;
      continue;
    }

    const path = await db.learningPath.create({
      data: {
        slug,
        title: seed.title,
        description: seed.description,
        color: seed.color,
        isPublished: true,
        createdById: users["admin@example.com"],
        items: {
          create: seed.courses
            .filter((title) => createdCourses[title])
            .map((title, index) => ({
              courseId: createdCourses[title],
              order: index,
              isRequired: true,
            })),
        },
      },
      select: { id: true },
    });

    createdPaths[seed.title] = path.id;
    pathCount += 1;
  }
  console.log(`  ✓ ${pathCount} learning paths`);

  /* ---------------------------------------------------------------------- */
  /* Enrollments, progress, reviews                                          */
  /* ---------------------------------------------------------------------- */

  const learners = people
    .filter((p) => p.role === "LEARNER")
    .map((p) => users[p.email]);

  const courseIds = Object.values(createdCourses);
  let enrollmentCount = 0;

  for (const [learnerIndex, learnerId] of learners.entries()) {
    // Deterministic spread so the seeded dashboards look varied but stable.
    const take = 2 + (learnerIndex % 3);
    const picks = courseIds.slice(learnerIndex % 3, (learnerIndex % 3) + take);

    for (const [pickIndex, courseId] of picks.entries()) {
      const existing = await db.enrollment.findUnique({
        where: { userId_courseId: { userId: learnerId, courseId } },
        select: { id: true },
      });
      if (existing) continue;

      const lessons = await db.lesson.findMany({
        where: { section: { courseId } },
        orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
        select: { id: true },
      });
      if (lessons.length === 0) continue;

      // 0%, ~40%, or 100% depending on position, so every dashboard state
      // is represented in the seed.
      const stage = (learnerIndex + pickIndex) % 3;
      const completeCount =
        stage === 0 ? 0 : stage === 1 ? Math.ceil(lessons.length * 0.4) : lessons.length;
      const percent = Math.round((completeCount / lessons.length) * 100);

      const enrollment = await db.enrollment.create({
        data: {
          userId: learnerId,
          courseId,
          source: "SELF",
          progressPercent: percent,
          startedAt: completeCount > 0 ? new Date() : null,
          completedAt: percent >= 100 ? new Date() : null,
          lastLessonId: completeCount > 0 ? lessons[completeCount - 1].id : null,
        },
        select: { id: true },
      });

      for (const lesson of lessons.slice(0, completeCount)) {
        await db.lessonProgress.create({
          data: {
            userId: learnerId,
            lessonId: lesson.id,
            enrollmentId: enrollment.id,
            completed: true,
            completedAt: new Date(),
          },
        });
      }

      await db.course.update({
        where: { id: courseId },
        data: { enrollmentCount: { increment: 1 } },
      });

      // Finishers leave a review.
      if (percent >= 100) {
        const rating = 4 + ((learnerIndex + pickIndex) % 2);
        await db.review.create({
          data: {
            userId: learnerId,
            courseId,
            rating,
            comment:
              rating === 5
                ? "Genuinely useful — I applied something from this the same week."
                : "Solid content, well paced. Would have liked a few more worked examples.",
          },
        });

        const course = await db.course.findUnique({
          where: { id: courseId },
          select: { title: true },
        });
        if (course) {
          await db.certificate.create({
            data: {
              userId: learnerId,
              courseId,
              title: course.title,
              serial: serial(),
            },
          });
        }
      }

      enrollmentCount += 1;
    }
  }

  // Refresh cached rating aggregates.
  for (const courseId of courseIds) {
    const agg = await db.review.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await db.course.update({
      where: { id: courseId },
      data: {
        ratingAvg: Number((agg._avg.rating ?? 0).toFixed(2)),
        ratingCount: agg._count.rating,
      },
    });
  }
  console.log(`  ✓ ${enrollmentCount} enrollments with progress, reviews, certificates`);

  /* ---------------------------------------------------------------------- */
  /* Mandatory assignments                                                   */
  /* ---------------------------------------------------------------------- */

  const complianceId = createdCourses["Workplace Conduct & Compliance"];
  let assignmentCount = 0;

  if (complianceId) {
    const dueDates = [-5, 3, 14, 30, 45]; // days from now; negatives are overdue

    for (const [index, learnerId] of learners.entries()) {
      const existing = await db.assignment.findFirst({
        where: { userId: learnerId, courseId: complianceId },
        select: { id: true },
      });
      if (existing) continue;

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + dueDates[index % dueDates.length]);

      await db.assignment.create({
        data: {
          userId: learnerId,
          assignedById: users["admin@example.com"],
          courseId: complianceId,
          dueAt,
          note: "Annual compliance refresher — required for all staff.",
        },
      });

      await db.enrollment.upsert({
        where: { userId_courseId: { userId: learnerId, courseId: complianceId } },
        create: { userId: learnerId, courseId: complianceId, source: "ASSIGNED" },
        update: {},
      });

      await db.notification.create({
        data: {
          userId: learnerId,
          type: "ASSIGNMENT",
          title: "New required training: Workplace Conduct & Compliance",
          body: `Due ${dueAt.toLocaleDateString()}.`,
          link: "/courses/workplace-conduct-compliance",
        },
      });

      assignmentCount += 1;
    }
  }
  console.log(`  ✓ ${assignmentCount} required-training assignments`);

  /* ---------------------------------------------------------------------- */
  /* Q&A                                                                     */
  /* ---------------------------------------------------------------------- */

  const securityCourseId = createdCourses["Secure Coding Fundamentals"];
  if (securityCourseId) {
    const existing = await db.question.count({ where: { courseId: securityCourseId } });
    if (existing === 0) {
      const question = await db.question.create({
        data: {
          courseId: securityCourseId,
          userId: users["daniel@example.com"] ?? users["learner@example.com"],
          title: "Does an ORM protect against SQL injection automatically?",
          body: "We use an ORM for most queries but drop to raw SQL for a few reporting endpoints. Are those the only places I need to worry about?",
        },
        select: { id: true },
      });

      await db.answer.create({
        data: {
          questionId: question.id,
          userId: users["instructor@example.com"],
          body: "Mostly, but not entirely. ORMs parameterise their generated queries, so ordinary usage is safe. The gaps are raw SQL escape hatches (your reporting endpoints), any `whereRaw`-style method, and dynamic identifiers like sort columns — those aren't parameterisable in any driver. Grep for the raw query methods in your codebase and review each one; there are usually fewer than you'd expect.",
        },
      });
    }
  }

  console.log("\n✓ Seed complete.\n");
  console.log("  Sign in with any of these — password for all is:", DEFAULT_PASSWORD);
  console.log("    admin@example.com       (Admin)");
  console.log("    instructor@example.com  (Instructor)");
  console.log("    learner@example.com     (Learner)\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
