"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself, where
 * `error.tsx` cannot help because the layout — and therefore the stylesheet — has
 * not rendered. Everything here is inline-styled for that reason.
 *
 * The most likely trigger in practice is a misconfigured environment, so the copy
 * points at that rather than offering a generic apology.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e8ecf3",
          color: "#1f2733",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "#e8ecf3",
            borderRadius: "20px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "12px 12px 24px #c3cad6, -12px -12px 24px #ffffff",
          }}
        >
          <h1 style={{ fontSize: "20px", margin: "0 0 8px", fontWeight: 700 }}>
            Lumina could not start
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#5a6675" }}>
            The application failed before it could render. This is usually a
            configuration problem — most often a missing <code>AUTH_SECRET</code> or
            an unreachable database.
          </p>

          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "12px",
                color: "#8c97a6",
                margin: "0 0 20px",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: "16px",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(135deg, #818cf8, #4f46e5)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
