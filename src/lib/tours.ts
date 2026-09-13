import { ROLE_RANK, type Role } from "@/lib/enums";

/**
 * Guided tours.
 *
 * One tour per screen, matched by route and gated by role, so a learner is never
 * walked through an admin control they cannot see.
 *
 * Two rules the content follows, because the failure mode of product tours is
 * being patronising:
 *
 *  - Steps explain things that are *not* obvious from the label. "This is the
 *    search box" earns nothing; "filters live in the URL, so a filtered view is
 *    a link you can share" is worth a step.
 *  - Short. Three to five steps. A fourteen-step tour gets skipped, which teaches
 *    the user to skip the next one too.
 *
 * Targets are `data-tour` attributes on the real UI rather than CSS classes or
 * structural selectors, so restyling cannot silently break a tour. A step whose
 * target is missing is skipped at runtime rather than showing an empty spotlight.
 */

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  /** Value of the data-tour attribute to highlight. Omit for a centred step. */
  target?: string;
  title: string;
  body: string;
  placement?: Placement;
  /**
   * The anchor only renders in some states — for example the required-training
   * section, which is absent for anyone with nothing assigned. The engine drops
   * such a step silently; marking it here records that as intended, so a tour
   * audit can distinguish "conditional" from "the anchor got renamed".
   */
  optional?: boolean;
}

export interface Tour {
  id: string;
  /** Shown in the launcher button tooltip and the replay list. */
  name: string;
  /**
   * Route this tour belongs to. `exact` matches the pathname exactly; otherwise it
   * matches as a prefix, which is how dynamic routes are covered.
   */
  route: string;
  exact?: boolean;
  /**
   * Pathnames the prefix must not swallow. A prefix like "/instructor/courses/" also
   * matches "/instructor/courses/new", which is a different screen with none of the
   * builder's anchors — so the tour resolved there and had nothing to show.
   */
  exclude?: string[];
  minRole?: Role;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  /* ------------------------------------------------------------------ */
  /* Learner                                                             */
  /* ------------------------------------------------------------------ */
  {
    id: "dashboard-v1",
    name: "Your dashboard",
    route: "/dashboard",
    exact: true,
    steps: [
      {
        target: "dashboard-hero",
        title: "Start here each day",
        body: "This picks up whichever course you touched last, so you rarely need to go looking. The ring is your average completion across everything you're enrolled in.",
        placement: "bottom",
      },
      {
        target: "dashboard-stats",
        title: "These tiles are links",
        body: "Each one opens the records behind the number — 'In progress' goes straight to a filtered list rather than making you find it.",
        placement: "bottom",
      },
      {
        target: "dashboard-required",
        title: "Required training is separated out",
        body: "Anything assigned to you with a due date sits here, colour-coded as it approaches. Overdue items turn red and are also reported to your administrator.",
        placement: "top",
        // Absent for anyone with nothing assigned.
        optional: true,
      },
      {
        target: "nav-my-learning",
        title: "Everything you've enrolled in",
        body: "My Learning splits your courses by progress. The catalog is for finding new ones.",
        placement: "right",
      },
    ],
  },

  {
    id: "catalog-v1",
    name: "Finding courses",
    route: "/catalog",
    exact: true,
    steps: [
      {
        target: "catalog-search",
        title: "Search covers more than titles",
        body: "It also matches subtitles, descriptions, tags, instructor names, and categories — so searching a topic or a colleague's name both work.",
        placement: "bottom",
      },
      {
        target: "catalog-filters",
        title: "Filters live in the URL",
        body: "That means a filtered view is just a link. Narrow things down, then paste the address to a colleague and they'll see exactly what you see.",
        placement: "bottom",
      },
      {
        target: "catalog-grid",
        title: "Cards show where you left off",
        body: "Once you're enrolled, a card swaps its enrollment stats for your progress bar, so the grid doubles as a status view.",
        placement: "top",
      },
    ],
  },

  {
    id: "course-detail-v1",
    name: "Course pages",
    route: "/courses/",
    steps: [
      {
        target: "course-enroll",
        title: "Enrolling drops you straight in",
        body: "You'll land on the first lesson rather than back here. Your place is remembered from then on.",
        placement: "left",
      },
      {
        target: "course-tabs",
        title: "Curriculum, reviews, and Q&A",
        body: "The curriculum tab lists every lesson. Anything marked Preview is watchable before you enrol — useful for deciding whether a course is what you need.",
        placement: "bottom",
      },
      {
        target: "course-meta",
        title: "Run time is the real total",
        body: "Duration comes from the actual lesson content, not an estimate, so you can plan around it.",
        placement: "bottom",
      },
    ],
  },

  {
    id: "player-v1",
    name: "Taking a lesson",
    route: "/learn/",
    steps: [
      {
        target: "player-main",
        title: "Progress is tracked as you watch",
        body: "Your position is saved every few seconds, and the lesson completes itself once you've watched most of it — there's no button to remember.",
        placement: "bottom",
      },
      {
        target: "player-curriculum",
        title: "Move around freely",
        body: "Jump to any lesson from here. Ticks show what you've finished, and the count at the top is your progress through the course.",
        placement: "left",
      },
      {
        target: "player-panels",
        title: "Notes and questions stay with the lesson",
        body: "Notes are private to you. Questions are visible to the instructor and your colleagues, and the instructor is notified.",
        placement: "left",
      },
      {
        target: "player-next",
        title: "Keyboard shortcuts work too",
        body: "Space or K plays and pauses, J and L skip back and forward ten seconds, and F is fullscreen.",
        placement: "top",
      },
    ],
  },

  {
    id: "my-learning-v1",
    name: "My Learning",
    route: "/my-learning",
    exact: true,
    steps: [
      {
        target: "my-learning-tabs",
        title: "Grouped by where you are",
        body: "In progress, not started, and completed. The tab you're on is part of the address, so you can bookmark the view you use most.",
        placement: "bottom",
      },
      {
        target: "nav-certificates",
        title: "Completions become certificates",
        body: "Finish a course and a certificate is issued automatically, with a verification code you can quote. They're printable.",
        placement: "right",
      },
    ],
  },

  {
    id: "leaderboard-v1",
    name: "Leaderboard",
    route: "/leaderboard",
    exact: true,
    steps: [
      {
        target: "leaderboard-period",
        title: "A rolling window, not a calendar one",
        body: "Thirty or ninety days back from today, so the board never resets to empty on the first of the month. The period is part of the address, so you can link someone straight to the view you mean.",
        placement: "bottom",
      },
      {
        target: "leaderboard-you",
        title: "Your standing is yours",
        body: "Where you sit among everyone with activity this period. Nobody else sees this row — the public list is the top ten only, and there is deliberately no full ranking.",
        placement: "bottom",
        optional: true,
      },
      {
        target: "leaderboard-list",
        title: "Courses first, then lessons",
        body: "Ties on completed courses are broken by lessons finished, so steady progress through a long course still counts for something.",
        placement: "top",
        optional: true,
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Instructor                                                          */
  /* ------------------------------------------------------------------ */
  {
    id: "instructor-v1",
    name: "Your courses",
    route: "/instructor",
    exact: true,
    minRole: "INSTRUCTOR",
    steps: [
      {
        target: "instructor-new",
        title: "Start with the outline",
        body: "Create the course first with just a title and description. Sections, lessons, and quizzes come after — nothing is visible to learners until you publish.",
        placement: "bottom",
      },
      {
        target: "instructor-list",
        title: "Draft, published, archived",
        body: "Only published courses appear in the catalog. Archiving pulls a course from the catalog without deleting anyone's progress.",
        placement: "top",
      },
    ],
  },

  {
    id: "course-create-v1",
    name: "Creating a course",
    route: "/instructor/courses/new",
    exact: true,
    minRole: "INSTRUCTOR",
    steps: [
      {
        target: "create-basics",
        title: "Only the title is required",
        body: "Everything else can be filled in later. Getting the course created is what unlocks the curriculum builder, so don't labour over the description now.",
        placement: "bottom",
      },
      {
        target: "create-objectives",
        title: "One outcome per line",
        body: "These render as the checklist learners see before enrolling. Write what they'll be able to *do*, not what the course covers.",
        placement: "top",
      },
      {
        target: "create-submit",
        title: "It's created as a draft",
        body: "Nothing is visible to learners until you publish, and publishing needs at least one lesson — so you can save a rough outline safely.",
        placement: "top",
      },
    ],
  },

  {
    id: "course-builder-v1",
    name: "Building a course",
    route: "/instructor/courses/",
    // "/instructor/courses/new" is the create form, not the builder.
    exclude: ["/instructor/courses/new"],
    minRole: "INSTRUCTOR",
    steps: [
      {
        target: "builder-tabs",
        title: "Curriculum, details, media",
        body: "Curriculum is where you'll spend most of your time. Media holds the thumbnail; Details covers what learners read before enrolling.",
        placement: "bottom",
      },
      {
        target: "builder-curriculum",
        title: "Sections hold lessons",
        body: "Add a section, then lessons inside it. Lessons can be video, an article, a quiz, or a downloadable file, and both sections and lessons can be reordered.",
        placement: "top",
      },
      {
        target: "builder-publish",
        title: "Publishing needs at least one lesson",
        body: "The button stays disabled until then — an empty course that learners can enrol into is worse than no course.",
        placement: "left",
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* Administrator                                                       */
  /* ------------------------------------------------------------------ */
  {
    id: "admin-overview-v1",
    name: "Organisation overview",
    route: "/admin",
    exact: true,
    minRole: "ADMIN",
    steps: [
      {
        target: "admin-stats",
        title: "Every number opens its records",
        body: "These tiles link through — 'People' to the user list, 'Certificates' to the org-wide register. Nothing here is a dead end.",
        placement: "bottom",
      },
      {
        target: "admin-compliance",
        title: "Compliance at a glance",
        body: "Open and overdue required training. Both link to a filtered register, so you can go straight to who is behind.",
        placement: "bottom",
      },
      {
        target: "nav-admin-roles",
        title: "Roles and permissions",
        body: "The full permission matrix lives here, generated from what the application actually enforces rather than maintained by hand.",
        placement: "right",
      },
    ],
  },

  {
    id: "admin-users-v1",
    name: "Managing people",
    route: "/admin/users",
    exact: true,
    minRole: "ADMIN",
    steps: [
      {
        target: "admin-users-filters",
        title: "Filter by role and status",
        body: "Deactivated accounts are dimmed. Deactivating blocks sign-in immediately without deleting any progress — use it for leavers rather than deleting.",
        placement: "bottom",
      },
      {
        target: "admin-users-add",
        title: "Accounts can be created directly",
        body: "You set an initial password and share it. They can change it themselves afterwards.",
        placement: "left",
      },
      {
        target: "admin-users-table",
        title: "Manage opens everything for one person",
        body: "Role, department, active status, and a password reset. You can't remove your own admin role or deactivate the last administrator.",
        placement: "top",
      },
    ],
  },

  {
    id: "admin-assignments-v1",
    name: "Required training",
    route: "/admin/assignments",
    exact: true,
    minRole: "ADMIN",
    steps: [
      {
        target: "assign-form",
        title: "Assign a course or a path",
        body: "Filter people by department, pick a due date, and assigning also enrols them — so it appears in their My Learning straight away.",
        placement: "top",
      },
      {
        target: "assign-register",
        title: "Track who's behind",
        body: "The register filters by open, overdue, and completed. The reminder button notifies everyone whose training is due soon or already late.",
        placement: "top",
      },
    ],
  },

  {
    id: "admin-roles-v1",
    name: "Roles and access",
    route: "/admin/roles",
    exact: true,
    minRole: "ADMIN",
    steps: [
      {
        target: "roles-cards",
        title: "Three hierarchical roles",
        body: "Each includes everything below it. Instructors can author, but only for courses they own; administrators act across all of them.",
        placement: "bottom",
      },
      {
        target: "roles-matrix",
        title: "This table is generated, not written",
        body: "It comes from the same permission model the guards check, so it can't drift from what's actually enforced. Change a role's capabilities by editing that model.",
        placement: "top",
      },
    ],
  },
];

/** The tour for a pathname, if the user's role qualifies. */
export function tourForRoute(pathname: string, role: Role): Tour | null {
  const candidates = TOURS.filter((tour) => {
    if (tour.exclude?.includes(pathname)) return false;
    return tour.exact ? pathname === tour.route : pathname.startsWith(tour.route);
  })
    // Longest route wins, so /instructor/courses/x prefers the builder tour over
    // the instructor-list tour.
    .sort((a, b) => b.route.length - a.route.length);

  for (const tour of candidates) {
    if (!tour.minRole || ROLE_RANK[role] >= ROLE_RANK[tour.minRole]) return tour;
  }
  return null;
}

/** Every tour a role can see, for the replay list. */
export function toursForRole(role: Role): Tour[] {
  return TOURS.filter(
    (tour) => !tour.minRole || ROLE_RANK[role] >= ROLE_RANK[tour.minRole]
  );
}
