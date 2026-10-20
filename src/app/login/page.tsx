import { supabaseLogin, supabaseRegister } from "@/app/actions";

function errorMessage(error?: string, reason?: string) {
  if (error === "credentials") return "Email or password was not accepted.";
  if (error === "register") {
    if (reason === "exists") return "May account na sa email na ito. Mag-sign in gamit ang account na iyon.";
    if (reason === "rate") return "Masyadong maraming registration o confirmation email ang na-request. Maghintay muna bago subukan ulit.";
    if (reason === "weak") return "Hindi pasado sa password policy ng Supabase. Gumamit ng mas malakas na password.";
    if (reason === "disabled") return "Naka-disable ang bagong sign-up sa Supabase Auth settings.";
    if (reason === "student-number") return "May account na gamit ang student number na iyan. I-check ang number o gamitin ang kasalukuyan mong account.";
    if (reason === "database") return "Hindi nakagawa ang database ng student profile. Tingnan ang Supabase Auth logs at database trigger.";
    return "Hindi nakumpleto ang registration. Tingnan ang Supabase Auth logs para sa detalye.";
  }
  if (error === "profile") {
    return "Your Supabase account does not have an active OJT profile. Ask an administrator to create or activate it.";
  }
  if (error === "permission") return "Your account does not have permission to open that page.";
  return "Please check the form and try again.";
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; registered?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="login">
      <section className="login-box">
        <div className="brand" style={{ color: "#152e45" }}>
          <span className="brand-mark">O</span>OJT Monitor
        </div>
        <h1>Welcome to the portal</h1>
        <p className="subtle">Sign in to continue to your internship workspace.</p>
        {query.error && <div className="notice error">{errorMessage(query.error, query.reason)}</div>}
        {query.registered && (
          <div className="notice success">
            Account created. Verify your email if confirmation is enabled, then sign in.
          </div>
        )}

        <div className="auth-forms">
            <form action={supabaseLogin}>
              <div className="field">
                <label>Email</label>
                <input type="email" name="email" required autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" name="password" required autoComplete="current-password" />
              </div>
              <button className="button" style={{ width: "100%", marginTop: 17 }}>
                Sign in
              </button>
            </form>
            <details style={{ marginTop: 20 }}>
              <summary>Create a student account</summary>
              <form action={supabaseRegister}>
                <div className="field">
                  <label>Full name</label>
                  <input name="name" required minLength={2} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" name="email" required />
                </div>
                <div className="field">
                  <label>Student number</label>
                  <input name="studentNumber" required minLength={3} maxLength={40} autoComplete="off" />
                </div>
                <div className="field">
                  <label>Program</label>
                  <input name="program" required minLength={2} maxLength={120} placeholder="e.g. BS Information Technology" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" name="password" required minLength={10} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{10,}" title="Use at least 10 characters with uppercase, lowercase, a number, and a special character." autoComplete="new-password" />
                  <span className="small">At least 10 characters with uppercase, lowercase, a number, and a special character.</span>
                </div>
                <button className="button secondary" style={{ marginTop: 12 }}>
                  Register
                </button>
              </form>
            </details>
        </div>

        <p className="small">Coordinator and supervisor roles must be provisioned by an administrator.</p>
      </section>
    </main>
  );
}
