/**
 * Lumina LMS — central customization file.
 *
 * This is the single place to rebrand and re-scope the platform. Nothing here
 * requires touching component code: colours feed the CSS custom properties in
 * `src/app/globals.css`, feature flags gate whole routes and nav entries, and
 * the taxonomy arrays drive the seed data and admin dropdowns.
 */

export type FeatureFlag =
  | "catalog"
  | "learningPaths"
  | "mandatoryTraining"
  | "certificates"
  | "reviews"
  | "discussions"
  | "notes"
  | "quizzes"
  | "notifications"
  | "leaderboard"
  | "selfEnrollment";

export interface LuminaConfig {
  brand: {
    name: string;
    tagline: string;
    organization: string;
    /** Shown on generated certificates. */
    certificateAuthority: string;
    supportEmail: string;
  };
  /**
   * Accent ramp. These are injected as `--accent-*` custom properties, so a
   * single edit here re-skins buttons, focus rings, charts, and glows.
   */
  theme: {
    accent: string;
    accentSoft: string;
    accentStrong: string;
    /** Secondary hue used for gradients and category chips. */
    secondary: string;
    /** Default colour scheme when a user has no stored preference. */
    defaultMode: "light" | "dark" | "system";
    /** Neumorphic extrusion depth in pixels. Larger = more pronounced. */
    depth: number;
    /** Corner rounding in pixels for cards and controls. */
    radius: number;
  };
  features: Record<FeatureFlag, boolean>;
  learning: {
    /** A lesson counts as complete once the learner passes this watch ratio. */
    videoCompletionThreshold: number;
    /** Minimum score (percent) required to pass a quiz. */
    quizPassingScore: number;
    /** Maximum quiz attempts. 0 = unlimited. */
    quizMaxAttempts: number;
    /** Course completion percent required before a certificate is issued. */
    certificateThreshold: number;
    /** Days before a due date that a reminder notification fires. */
    dueSoonReminderDays: number;
  };
  catalog: {
    pageSize: number;
    levels: readonly string[];
    /** Seeded on first run; admins can add more from the console. */
    defaultCategories: readonly { name: string; icon: string; color: string }[];
  };
}

export const luminaConfig: LuminaConfig = {
  brand: {
    name: process.env.NEXT_PUBLIC_APP_NAME || "Lumina",
    tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "Learning, elevated.",
    organization: process.env.NEXT_PUBLIC_ORG_NAME || "Your Organization",
    certificateAuthority: "Learning & Development",
    supportEmail: "learning@example.com",
  },

  theme: {
    accent: "#6366f1",
    accentSoft: "#818cf8",
    accentStrong: "#4f46e5",
    secondary: "#06b6d4",
    defaultMode: "system",
    depth: 9,
    radius: 20,
  },

  features: {
    catalog: true,
    learningPaths: true,
    mandatoryTraining: true,
    certificates: true,
    reviews: true,
    discussions: true,
    notes: true,
    quizzes: true,
    notifications: true,
    leaderboard: true,
    selfEnrollment: true,
  },

  learning: {
    videoCompletionThreshold: 0.9,
    quizPassingScore: 70,
    quizMaxAttempts: 3,
    certificateThreshold: 100,
    dueSoonReminderDays: 7,
  },

  catalog: {
    pageSize: 12,
    levels: ["Beginner", "Intermediate", "Advanced", "All Levels"],
    defaultCategories: [
      { name: "Onboarding", icon: "Rocket", color: "#6366f1" },
      { name: "Engineering", icon: "Code2", color: "#06b6d4" },
      { name: "Product & Design", icon: "Palette", color: "#ec4899" },
      { name: "Data & Analytics", icon: "BarChart3", color: "#8b5cf6" },
      { name: "Leadership", icon: "Users", color: "#f59e0b" },
      { name: "Compliance & Safety", icon: "ShieldCheck", color: "#10b981" },
      { name: "Sales & Marketing", icon: "TrendingUp", color: "#ef4444" },
      { name: "Professional Skills", icon: "Sparkles", color: "#14b8a6" },
    ],
  },
};

export default luminaConfig;
