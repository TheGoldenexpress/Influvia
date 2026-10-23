"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Logo, api, post } from "./shared";

export function OwnerAuth({ invitation = false }: { invitation?: boolean }) {
  const token = useRef("");
  const [details, setDetails] = useState<{
    email: string;
    expiresAt: number;
  } | null>(null);
  const [loading, setLoading] = useState(invitation);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!invitation) return;
    token.current ||=
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    // A URL fragment never reaches the server or referrer. Clear browser history too.
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;
    if (!token.current) {
      setError(
        "Open the full private invitation link shared with you by an owner.",
      );
      setLoading(false);
      return;
    }
    api("auth/owner-invitation", post({ token: token.current }))
      .then((data) => {
        if (active) {
          setDetails(data);
          setEmail(data.email);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invitation]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (invitation && password !== confirmation) {
      setError("The passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      await api(
        invitation ? "auth/owner-accept" : "auth/owner-login",
        post({
          email,
          password,
          ...(invitation ? { token: token.current, name } : {}),
        }),
      );
      token.current = "";
      window.location.assign("/owner");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="owner-auth-page">
      <header>
        <Logo />
        <a href="/">
          Back to website <ArrowUpRight size={15} />
        </a>
      </header>
      <main className="owner-auth-main">
        <section className="owner-auth-story">
          <span className="eyebrow">INFLUVIA / OWNER ACCESS</span>
          <h1>
            Your directory.
            <br />
            <span>Your control.</span>
          </h1>
          <p>A private workspace for the people behind the platform.</p>
          <div className="owner-auth-diagram" aria-hidden="true">
            <div>
              <ShieldCheck size={36} />
              <span>OWNER’S STUDIO</span>
            </div>
            <i />
            <div>
              <UsersGlyph />
              <span>CREATORS · CUSTOMERS · MEMBERSHIPS</span>
            </div>
          </div>
          <ul>
            <li>
              <Check size={15} /> Manage your creator directory
            </li>
            <li>
              <Check size={15} /> Set memberships and access
            </li>
            <li>
              <Check size={15} /> Keep every change accountable
            </li>
          </ul>
          <small>INVITATION ONLY. BUILT FOR YOUR BUSINESS.</small>
        </section>
        <section
          className="owner-auth-card"
          aria-label={invitation ? "Accept owner invitation" : "Owner sign in"}
        >
          <span className="owner-auth-icon">
            {invitation ? <Mail size={23} /> : <KeyRound size={23} />}
          </span>
          <span className="eyebrow">
            {invitation ? "YOU’RE INVITED" : "WELCOME BACK"}
          </span>
          <h2>{invitation ? "Make it yours." : "Owner sign in."}</h2>
          <p>
            {invitation
              ? "Accept your invitation and choose the password you’ll use to manage INFLUVIA."
              : "Sign in with your invited email and owner password."}
          </p>
          {error ? (
            <div className="alert error" role="alert">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="owner-auth-loading" role="status">
              <LoaderCircle className="spin" size={20} /> Checking your
              invitation…
            </div>
          ) : invitation && !details ? (
            <div className="owner-auth-help">
              <p>
                Ask an existing owner to issue a fresh invitation from Owners &
                invites.
              </p>
              <a href="/owner/login">
                Already activated? Sign in <ArrowUpRight size={14} />
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              {invitation ? (
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </label>
              ) : null}
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  maxLength={200}
                  value={email}
                  readOnly={invitation}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your invited email address"
                />
              </label>
              <label>
                {invitation ? "Choose a password" : "Password"}
                <div className="owner-password">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      invitation ? "new-password" : "current-password"
                    }
                    minLength={10}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      invitation
                        ? "At least 10 characters"
                        : "Your owner password"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              {invitation ? (
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Repeat your password"
                  />
                </label>
              ) : null}
              <button className="button" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <LockKeyhole size={16} />
                )}
                {invitation
                  ? "Accept invitation & open studio"
                  : "Sign in to admin studio"}
                <span>
                  <ArrowUpRight size={16} />
                </span>
              </button>
            </form>
          )}
          <div className="owner-auth-help">
            {invitation && details ? (
              <p>
                One-time invitation. Valid until{" "}
                {new Date(details.expiresAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST. Accepting replaces any earlier password and signs out
                previous sessions.
              </p>
            ) : !invitation ? (
              <>
                <b>First time here or forgot your password?</b>
                <p>
                  Open your private invitation link to set a password. An
                  existing owner can issue a new link from Owners & invites.
                </p>
              </>
            ) : null}
          </div>
          <div className="owner-auth-foot">
            <ShieldCheck size={15} /> Private owner workspace{" "}
            <a href="/login">
              Customer login <ArrowUpRight size={12} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
function UsersGlyph() {
  return (
    <svg width="120" height="40" viewBox="0 0 120 40" fill="none">
      <g stroke="currentColor" strokeWidth="1.5">
        {[12, 60, 108].map((x) => (
          <g key={x}>
            <circle cx={x} cy="10" r="7" />
            <path d={`M${x - 11} 35v-4a11 11 0 0 1 22 0v4z`} />
          </g>
        ))}
      </g>
      <path d="M26 20h20m28 0h20" stroke="currentColor" strokeDasharray="3 4" />
    </svg>
  );
}
