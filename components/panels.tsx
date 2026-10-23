"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  LockKeyhole,
  LoaderCircle,
  RefreshCw,
  Plus,
  Users,
  LogOut,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { SAMPLE_CREATORS, PACKAGE_DRAFTS } from "../lib/catalog.mjs";
import { CheckoutPanel } from "./checkout";
import { AnalyticsPreference } from "./analytics-tracker";
import {
  Logo,
  Portrait,
  Footer,
  api,
  post,
  date,
  money,
  type Account,
  type Creator,
} from "./shared";
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.7 4.7 0 01-2.1 3.1v2.6H19c2-1.9 3-4.6 3-7.6z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.8 0 5.1-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.8v2.7A10.2 10.2 0 0012 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 13.7a6.2 6.2 0 010-3.4V7.6H2.8a10 10 0 000 8.8z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0012 2a10.2 10.2 0 00-9.2 5.6l3.4 2.7C7 7.9 9.3 6.1 12 6.1z"
      />
    </svg>
  );
}
export function Join({ login }: { login: boolean }) {
  const [providers, setProviders] = useState({
    google: false,
    facebook: false,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api("auth/providers")
      .then(setProviders)
      .catch(() => {});
    const n = new URLSearchParams(location.search).get("notice");
    if (n)
      setError(
        "This sign-in provider is being connected. Please use email for now.",
      );
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `auth/${login ? "login" : "register"}`,
        post({ name, email, password }),
      );
      location.href = "/brand";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <header className="simple-header">
        <Logo />
        <a className="text-link" href="/">
          Back to the good stuff <ArrowUpRight size={15} />
        </a>
      </header>
      <main className="auth-main">
        <div className="auth-editorial">
          <span className="eyebrow">THE RIGHT PEOPLE CHANGE EVERYTHING.</span>
          <h1>
            Your people.
            <br />
            <em>Your possibilities.</em>
          </h1>
          <div className="auth-portrait-mosaic">
            {(
              [
                SAMPLE_CREATORS[0],
                SAMPLE_CREATORS[1],
                SAMPLE_CREATORS[11],
              ] as Creator[]
            ).map((c) => (
              <div key={c.id}>
                <Portrait creator={c} />
              </div>
            ))}
          </div>
          <p>
            Somewhere nearby, there’s a creator
            <br />
            who gets your kind of story.
          </p>
          <span className="auth-editorial-foot">
            FREE TO JOIN. MADE FOR LOCAL.
          </span>
        </div>
        <section className="auth-card">
          <span className="auth-asterisk">✳</span>
          <span className="eyebrow">A GOOD PLACE TO BEGIN</span>
          <h2>{login ? "Welcome back." : "Let’s find your people."}</h2>
          <p>
            {login
              ? "Your next good discovery is waiting."
              : "Create a free account. Your first discoveries are on us."}
          </p>
          <div className="social-auth">
            <a
              className={!providers.google ? "provider-disabled" : ""}
              aria-disabled={!providers.google}
              href={providers.google ? "/api/auth/google" : undefined}
            >
              <GoogleIcon />
              Google
            </a>
            <a
              className={!providers.facebook ? "provider-disabled" : ""}
              aria-disabled={!providers.facebook}
              href={providers.facebook ? "/api/auth/facebook" : undefined}
            >
              <span className="facebook-glyph">f</span>Facebook
            </a>
          </div>
          {!providers.google || !providers.facebook ? (
            <small className="provider-note">
              Social sign-in is being connected. Email is available now.
            </small>
          ) : null}
          <div className="auth-divider">
            <span />
            or continue with email
            <span />
          </div>
          <form onSubmit={submit}>
            {error ? (
              <div className="alert error" role="alert">
                {error}
              </div>
            ) : null}
            {!login ? (
              <label>
                Your name
                <input
                  value={name}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="What should we call you?"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            ) : null}
            <label>
              Email address
              <input
                type="email"
                value={email}
                required
                maxLength={200}
                autoComplete="email"
                placeholder="you@yourbusiness.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete={login ? "current-password" : "new-password"}
                  value={password}
                  placeholder={
                    login ? "Your password" : "At least 10 characters"
                  }
                  onChange={(e) => setPassword(e.target.value)}
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
            <button className="button" disabled={busy}>
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {login ? "Log in to your account" : "Create free account"}
              <span>
                <ArrowUpRight size={17} />
              </span>
            </button>
          </form>
          <p className="auth-terms">
            By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
            <a href="/privacy">Privacy policy</a>.
          </p>
          <div className="auth-switch">
            {login ? "New around here?" : "Already have an account?"}{" "}
            <a href={login ? "/join" : "/login"}>
              {login ? "Join for free" : "Log in"}
              <ArrowUpRight size={12} />
            </a>
          </div>
          <a className="owner-sign-in" href="/owner/login">
            Owner sign in <ShieldCheck size={12} />
          </a>
        </section>
      </main>
    </div>
  );
}
export function Billing({
  account,
  ready,
  refresh,
  notify,
}: {
  account: Account | null;
  ready: boolean;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [plans, setPlans] = useState<any[]>(PACKAGE_DRAFTS);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api("packages")
      .then((d) => setPlans(d.packages))
      .catch((e) => setError(e.message));
  }, []);
  const checkout = async (id: string) => {
    if (!account) {
      location.href = "/join";
      return;
    }
    setCheckoutPlan(id);
  };
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DISCOVERY, WITH ROOM TO GROW.</span>
          <h1>
            A little more <em>possibility.</em>
          </h1>
          <p>Choose the membership that fits the way you discover.</p>
        </div>
        <button className="text-link" onClick={() => void refresh()}>
          Refresh access <RefreshCw size={14} />
        </button>
      </div>
      {error ? (
        <div role="alert" className="alert error">
          {error}
        </div>
      ) : null}
      {account?.paid ? (
        <div className="usage-banner">
          <ShieldCheck size={17} />
          <p>
            <b>{account.plan?.name}</b> membership is active until{" "}
            {date(account.accessUntil!)}.
          </p>
          <a href="/brand">
            Start discovering <ArrowUpRight size={15} />
          </a>
        </div>
      ) : null}
      <div className="membership-grid">
        <div className="membership-card">
          <span className="plan-eyebrow">GET ACQUAINTED</span>
          <h3>Free</h3>
          <p>Start with a little curiosity.</p>
          <div className="plan-price">
            ₹0<span>always</span>
          </div>
          <ul>
            <li>
              <Check />
              Free registration & login
            </li>
            <li>
              <Check />
              10 results with every search
            </li>
            <li>
              <Check />
              Names & platform labels
            </li>
            <li>
              <Check />
              All discovery filters
            </li>
            <li className="muted-list">
              <LockKeyhole />
              Contacts, social URLs & exports locked
            </li>
          </ul>
          <a href={account ? "/brand" : "/join"} className="button outline">
            {account ? "Your free workspace" : "Create free account"}
            <span>
              <ArrowUpRight size={16} />
            </span>
          </a>
        </div>
        {plans.map((p, i) => (
          <div
            className={`membership-card ${i === 0 ? "featured-plan" : ""}`}
            key={p.id}
          >
            {i === 0 ? (
              <span className="popular-label">A GOOD PLACE TO GROW</span>
            ) : null}
            <span className="plan-eyebrow">
              {i === 0 ? "THE LOCAL ADVANTAGE" : "ROOM FOR EVERYTHING"}
            </span>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <div className="plan-price">
              {p.configured ? money(p.price) : "Coming soon"}
              <span>
                {p.configured
                  ? "/ 30 days"
                  : "Your next chapter is taking shape"}
              </span>
            </div>
            <ul>
              <li>
                <Check />
                {p.searchLimit === null
                  ? "Unlimited searches"
                  : `${p.searchLimit} searches per calendar month`}
              </li>
              <li>
                <Check />
                {p.resultLimit === null
                  ? "Full results with every search"
                  : `Up to ${p.resultLimit} results per search`}
              </li>
              <li>
                <Check />
                Phone & email when available
              </li>
              <li>
                <Check />
                Instagram, Facebook & channel URLs
              </li>
              <li>
                <Check />
                Filtered Excel exports
              </li>
            </ul>
            <button
              className={`button ${i === 0 ? "" : "outline"}`}
              disabled={
                !!busy ||
                !p.configured ||
                (!ready && !!account && !account.owner) ||
                (!!account?.paid && !account.owner)
              }
              onClick={() => void checkout(p.id)}
            >
              {busy === p.id ? (
                <LoaderCircle className="spin" size={16} />
              ) : null}
              {account?.packageId === p.id
                ? "Your current membership"
                : !p.configured
                  ? "Membership opening soon"
                  : !ready && account && !account.owner
                    ? "Checkout opening soon"
                    : `Choose ${p.name}`}
              <span>
                <ArrowUpRight size={16} />
              </span>
            </button>
            <small>One-time payment. No automatic renewal.</small>
          </div>
        ))}
      </div>
      <CheckoutPanel
        account={account}
        packageId={checkoutPlan}
        onClose={() => setCheckoutPlan(null)}
        refresh={refresh}
        notify={notify}
      />
      <div className="billing-faq">
        <h2>A few good things to know.</h2>
        {[
          [
            "What can I see for free?",
            "Every free search returns up to 10 creator results with names, platform labels and non-contact discovery information. Social profile URLs, handles, phone and email are withheld by the server.",
          ],
          [
            "How do monthly search limits work?",
            "A submitted search or applied set of filters counts once. Paging through that search and exporting its accessible results does not consume another search. Monthly counters follow the calendar month in India.",
          ],
          [
            "Can creators accept a free collaboration?",
            "Profiles marked “Open to free collabs” accept relevant product exchanges or experiences, such as a restaurant dinner. Filter for this option and confirm availability independently.",
          ],
          [
            "Can I contact creators through the portal?",
            "INFLUVIA is a discovery and export directory. Paid memberships unlock business details and social profiles; outreach happens independently outside this portal.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <Plus size={16} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
export function Exports({ account }: { account: Account | null }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (account)
      api("exports")
        .then((d) => setRows(d.rows))
        .catch((e) => setError(e.message));
  }, [account]);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR GOOD FINDS, ALL TOGETHER.</span>
          <h1>
            My <em>exports.</em>
          </h1>
          <p>A little history of the possibilities you’ve found.</p>
        </div>
        <a className="button outline compact" href="/brand">
          Back to discovery{" "}
          <span>
            <Search size={16} />
          </span>
        </a>
      </div>
      {error ? (
        <div role="alert" className="alert error">
          {error}
        </div>
      ) : null}
      <div className="content-card">
        {!rows.length ? (
          <div className="empty-state">
            <FileSpreadsheet size={35} />
            <h2>
              Your next shortlist
              <br />
              <em>belongs here.</em>
            </h2>
            <p>
              {account
                ? "Your downloads will appear here with their filters, dates and creator counts. Excel files are saved to your device."
                : "Log in to see your export history."}
            </p>
            <a className="button" href={account ? "/brand" : "/login"}>
              {account ? "Find your first creators" : "Log in"}
              <span>
                <ArrowUpRight size={16} />
              </span>
            </a>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SPREADSHEET</th>
                  <th>CREATORS</th>
                  <th>FILTERS</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = JSON.parse(r.details);
                  return (
                    <tr key={r.id}>
                      <td>
                        <FileSpreadsheet size={17} /> Creator shortlist.xlsx
                      </td>
                      <td>{d.rowCount}</td>
                      <td>
                        {[
                          d.filters.region,
                          d.filters.district,
                          d.filters.industry,
                          d.filters.language,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "All creators"}
                      </td>
                      <td>{date(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
export function AccountPanel({
  account,
  refresh,
  notify,
}: {
  account: Account | null;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [name, setName] = useState(account?.name || "");
  const [company, setCompany] = useState(account?.company || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("profile", post({ name, company }));
      await refresh();
      notify("Your details are saved. Make yourself at home.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    const result = await api("auth/logout", post({}));
    location.href = result.native
      ? "/signout-with-chatgpt?return_to=/"
      : account?.owner
        ? "/owner/login"
        : "/login";
  };
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">A SPACE OF YOUR OWN.</span>
          <h1>
            Your <em>account.</em>
          </h1>
          <p>The person behind the next good idea.</p>
        </div>
      </div>
      {!account ? (
        <div className="content-card empty-state">
          <Users size={35} />
          <h2>
            Let’s get <em>acquainted.</em>
          </h2>
          <a href="/join" className="button">
            Create free account{" "}
            <span>
              <ArrowUpRight size={16} />
            </span>
          </a>
        </div>
      ) : (
        <div className="account-layout">
          <form className="content-card account-form" onSubmit={save}>
            <h2>A few personal details.</h2>
            {error ? (
              <div className="alert error" role="alert">
                {error}
              </div>
            ) : null}
            <label>
              Name
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Business / organisation
              <input
                maxLength={150}
                autoComplete="organization"
                placeholder="Where your ideas come to life"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            <label>
              Email
              <input disabled value={account.email} />
            </label>
            <button className="button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save my details{" "}
              <span>
                <ArrowRight size={16} />
              </span>
            </button>
          </form>
          <div className="content-card account-summary">
            <span className="user-avatar large">{account.name[0]}</span>
            <h2>{account.name}</h2>
            <p>{account.email}</p>
            <span className="plan-pill">
              {account.plan?.name || "Free"} membership
            </span>
            <div>
              <small>PART OF THE NEIGHBOURHOOD SINCE</small>
              <b>{date(account.createdAt)}</b>
            </div>
            <a href="/billing" className="text-link">
              Manage membership <ArrowUpRight size={15} />
            </a>
            <button className="logout-button" onClick={() => void logout()}>
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function Legal({ privacy }: { privacy: boolean }) {
  return (
    <div className="site-v2">
      <header className="simple-header">
        <Logo />
        <a href="/" className="text-link">
          Back home <ArrowUpRight size={15} />
        </a>
      </header>
      <main className="legal-page">
        <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY.</span>
        <h1>{privacy ? "Your privacy." : "Directory terms."}</h1>
        {(privacy
          ? [
              [
                "Your account",
                "INFLUVIA stores your name, email and optional business name. Email account passwords are stored as salted PBKDF2 hashes. Social sign-in uses the selected provider. Authentication cookies are HTTP-only.",
              ],
              [
                "Searches and exports",
                "The service records searches, filters, package limits and calendar-month usage. Excel exports are audited by date, filter and row count. Files download directly to your device.",
              ],
              [
                "Directory information",
                "Business information is entered or imported by authorised administrators. Free accounts receive at most 10 results and never receive contact details, social URLs or handles from the API. Fictional sample records are labelled.",
              ],
              [
                "Payments",
                "Configured payment providers handle checkout. INFLUVIA stores order references, status, amount, receipt claims and membership periods. Card credentials are entered only on provider checkout. Owner payment API credentials are encrypted on the server.",
              ],
              [
                "Usage analytics",
                "INFLUVIA measures page visits, clicks, shares, searches, registrations, sign-ins and checkout activity. A random HTTP-only visit cookie expires after 30 minutes. Events are retained for 93 days. Query strings, invitation tokens, form values, IP addresses and full referrer URLs are not stored in analytics. Owner traffic and browser Do Not Track or Global Privacy Control requests are excluded. Authorised owners can review accounts that signed in without a paid order.",
              ],
              [
                "Your data",
                "Update your account details in Settings. Request corrections or account deletion from the directory administrator through the business contact details supplied with your access.",
              ],
            ]
          : [
              [
                "Free membership",
                "Registration and login are free. Free searches return up to 10 creator results, with protected business contacts and social profile URLs withheld.",
              ],
              [
                "Paid packages",
                "The administrator sets package prices, monthly search allowances and results per search. Access begins after server verification of payment capture or an audited administrator activation. Membership lasts 30 days and does not renew automatically.",
              ],
              [
                "Search allowances",
                "Each submitted search counts once toward a paid calendar-month allowance, measured in India time. Viewing further pages and exporting the same search does not use another search. Search and export remain within the accessible result limit.",
              ],
              [
                "Creator information",
                "Follower metrics and prices are indicative. A free-collaboration badge signals willingness to discuss product exchanges or experiences, not a guaranteed offer. Verify details and availability independently.",
              ],
              [
                "Independent outreach",
                "The portal provides search and Excel export. It does not provide chat, messaging, booking or campaigns. All outreach occurs independently outside INFLUVIA. Respect recipients’ preferences and handle downloaded information responsibly.",
              ],
              [
                "Sample workspace",
                "Sample creator names, images and contact information are fictional examples. Sample exports are clearly labelled and are not intended for outreach.",
              ],
            ]
        ).map(([h, p]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{p}</p>
          </section>
        ))}
        {privacy ? (
          <section>
            <h2>Your analytics preference</h2>
            <p>
              Change usage analytics for this browser. Account security, search
              limits and financial records continue to work.
            </p>
            <AnalyticsPreference />
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
