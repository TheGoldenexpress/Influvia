"use client";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeft,
  Search,
  FileSpreadsheet,
  CreditCard,
  Settings,
  LayoutGrid,
  MapPin,
  Menu,
  X,
  CheckCircle2,
  ChevronRight,
  Gift,
  Compass,
  ShieldCheck,
  Users,
  Upload,
  History,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Wallet,
} from "lucide-react";
import { ADMIN_ROUTES, ADMIN_LABELS, adminTabFor } from "./admin-workspace";
import { Logo, api, date, type Account } from "./shared";
import { Directory } from "./directory";
import { Join, Billing, Exports, AccountPanel, Legal } from "./panels";
import { Admin } from "./admin";
import { OwnerAuth } from "./owner-auth";
export { Landing } from "./landing";
export function App() {
  const path = usePathname() || "/brand",
    demo = false;
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await api("me");
      setAccount(d.account);
      setReady(d.paymentReady || false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!demo) void refresh();
    else setLoading(false);
  }, [demo, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (path === "/owner/login") return <OwnerAuth />;
  if (path === "/owner/accept-invite") return <OwnerAuth invitation />;
  if (path === "/join" || path === "/register" || path === "/login")
    return <Join login={path === "/login"} />;
  if (path === "/privacy" || path === "/terms")
    return <Legal privacy={path === "/privacy"} />;
  if (!loading && !account && ["/brand", "/demo", "/discover"].includes(path))
    return <Join login={false} />;
  const section =
    path === "/owner" || path.startsWith("/owner/") || path === "/admin"
      ? "owner"
      : path === "/exports"
        ? "exports"
        : path === "/billing"
          ? "billing"
          : path === "/account"
            ? "account"
            : "directory";
  return (
    <Shell account={account} demo={demo} section={section}>
      {error ? (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      ) : null}
      {loading ? (
        <div className="workspace-skeleton" aria-label="Loading your workspace">
          <span />
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : section === "owner" ? (
        <Admin account={account} notify={setToast} />
      ) : section === "directory" ? (
        <Directory
          account={account}
          demo={demo}
          notify={setToast}
          refresh={refresh}
        />
      ) : section === "billing" ? (
        <Billing
          account={account}
          ready={ready}
          refresh={refresh}
          notify={setToast}
        />
      ) : section === "exports" ? (
        <Exports account={account} />
      ) : (
        <AccountPanel account={account} refresh={refresh} notify={setToast} />
      )}
      {toast ? (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </Shell>
  );
}
function Shell({
  children,
  account,
  demo,
  section,
}: {
  children: ReactNode;
  account: Account | null;
  demo: boolean;
  section: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/owner";
  const admin = section === "owner";
  const activeAdmin = adminTabFor(pathname);
  return (
    <div className={`workspace ${admin ? "admin-workspace" : ""}`}>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Logo light />
        <span className="sidebar-subtitle">
          {admin
            ? "DIRECTORY ADMINISTRATION"
            : "GOOD PEOPLE. GREAT POSSIBILITIES."}
        </span>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Compass size={19} />
          </span>
          <span>
            {section === "owner"
              ? "The owner’s studio"
              : "Your discovery space"}
            <small>{demo ? "Sample workspace" : "INFLUVIA workspace"}</small>
          </span>
        </div>
        <span className="nav-label">
          {admin ? "MANAGEMENT" : "YOUR WORKSPACE"}
        </span>
        <nav>
          {admin
            ? Object.entries(ADMIN_ROUTES).map(([id, href]) => (
                <a
                  key={id}
                  href={href}
                  className={activeAdmin === id ? "active" : ""}
                  aria-current={activeAdmin === id ? "page" : undefined}
                >
                  {
                    (
                      {
                        overview: <LayoutGrid />,
                        creators: <Users />,
                        import: <Upload />,
                        users: <ShieldCheck />,
                        packages: <SlidersHorizontal />,
                        audit: <History />,
                        invitations: <ShieldCheck />,
                        payments: <CreditCard />,
                        finance: <Wallet />,
                        analytics: <ChartNoAxesCombined />,
                      } as Record<string, ReactNode>
                    )[id]
                  }
                  {ADMIN_LABELS[id]}
                  {activeAdmin === id ? <i /> : null}
                </a>
              ))
            : [
                {
                  id: "directory",
                  text: "Discover creators",
                  href: demo ? "/demo" : "/brand",
                  icon: <Search />,
                },
                {
                  id: "exports",
                  text: "My exports",
                  href: "/exports",
                  icon: <FileSpreadsheet />,
                },
                {
                  id: "billing",
                  text: "Membership",
                  href: "/billing",
                  icon: <CreditCard />,
                },
              ].map((n) => (
                <a
                  className={section === n.id ? "active" : ""}
                  href={n.href}
                  key={n.id}
                >
                  {n.icon}
                  {n.text}
                  {section === n.id ? <i /> : null}
                </a>
              ))}
          {account?.owner && !admin ? (
            <a href="/owner" className={section === "owner" ? "active" : ""}>
              <LayoutGrid />
              Admin studio{section === "owner" ? <i /> : null}
            </a>
          ) : null}
        </nav>
        {admin ? (
          <div className="admin-sidebar-note">
            <ShieldCheck size={22} />
            <b>
              {account?.owner
                ? "Administrator access"
                : "Owner access required"}
            </b>
            <p>
              Creator data, customer access, and package settings in one
              workspace.
            </p>
            <a href="/brand">
              Open customer directory
              <ArrowUpRight size={14} />
            </a>
          </div>
        ) : (
          <div className="sidebar-membership">
            <span>✳</span>
            <b>
              {account?.paid
                ? "More room to discover."
                : "A little further goes a long way."}
            </b>
            <p>
              {account?.paid
                ? `${account.plan?.name} membership · active until ${date(account.accessUntil!)}`
                : "Unlock social profiles, business contacts, and Excel exports."}
            </p>
            <a href="/billing">
              {account?.paid ? "Your membership" : "Explore membership"}
              <ArrowUpRight size={15} />
            </a>
          </div>
        )}
        <div className="sidebar-bottom">
          <span className="sidebar-region">
            <MapPin size={15} />
            Rooted in Telangana.<small>Open to possibilities.</small>
          </span>
          <a href="/account">
            <Settings size={17} />
            Account settings
          </a>
          <a href="/">
            <ArrowLeft size={17} />
            Back to website
          </a>
        </div>
      </aside>
      {open ? (
        <button
          className="sidebar-shade"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="workspace-body">
        <header className="workspace-header">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              {admin ? "Admin" : "Workspace"} <ChevronRight size={12} />
              <b>
                {section === "directory"
                  ? "Discover creators"
                  : section === "owner"
                    ? ADMIN_LABELS[activeAdmin]
                    : section === "exports"
                      ? "My exports"
                      : section === "billing"
                        ? "Membership"
                        : "Account"}
              </b>
            </span>
          </div>
          <div className="workspace-user">
            <span className={`plan-pill ${account?.paid ? "paid" : ""}`}>
              {admin && account?.owner
                ? "ADMINISTRATOR"
                : demo
                  ? "SAMPLE WORKSPACE"
                  : account?.plan?.name || "FREE EXPLORER"}
            </span>
            <a href={account ? "/account" : "/login"}>
              <span className="user-avatar">{account?.name?.[0] || "G"}</span>
              <span>
                {account?.name?.split(" ")[0] || "Guest"}
                <small>
                  {account?.owner
                    ? "Administrator"
                    : account
                      ? "Your account"
                      : "Let’s get acquainted"}
                </small>
              </span>
            </a>
          </div>
        </header>
        <main className="workspace-main">{children}</main>
        <footer className="workspace-footer">
          <span>
            {admin
              ? "INFLUVIA Admin · Changes are recorded in the activity log."
              : "Local voices. Real possibilities."}
          </span>
          <a href="/terms">
            Search. Export. Connect independently. <ArrowUpRight size={12} />
          </a>
        </footer>
      </div>
    </div>
  );
}
