"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ADMIN_ROUTES,
  ADMIN_LABELS,
  adminTabFor,
  AdminOverview,
  AdminImport,
  AdminPagination,
} from "./admin-workspace";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Upload,
  Download,
  Search,
  Users,
  LayoutGrid,
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
  History,
  Check,
  LoaderCircle,
  Edit3,
  Gift,
  SlidersHorizontal,
  LockKeyhole,
  RefreshCw,
  X,
} from "lucide-react";
import { GEOGRAPHY, INDUSTRIES, LANGUAGES } from "../lib/catalog.mjs";
import { OwnerInvitations } from "./owner-invitations";
import {
  PaymentSettings,
  FinancePanel,
  AnalyticsPanel,
} from "./admin-commerce";
import {
  api,
  post,
  Dialog,
  date,
  money,
  compact,
  type Account,
  Portrait,
} from "./shared";
const emptyCreator = {
  name: "",
  region: "Telangana",
  district: "Hyderabad",
  city: "Hyderabad",
  niche: "Food blogger",
  language: "Telugu",
  followers: 0,
  engagement: 0,
  rate: 0,
  instagram: "",
  youtube: "",
  facebook: "",
  email: "",
  phone: "",
  bio: "",
  photo: "",
  acceptsFreeCollab: false,
};
export function Admin({
  account,
  notify,
}: {
  account: Account | null;
  notify: (s: string) => void;
}) {
  const router = useRouter();
  const tab = adminTabFor(usePathname() || "/owner");
  const setTab = (next: string) => router.push(ADMIN_ROUTES[next] || "/owner");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [modalError, setModalError] = useState("");
  const [accessUser, setAccessUser] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [lastImport, setLastImport] = useState<any>(null);
  const [records, setRecords] = useState<any>({
    rows: [],
    page: 1,
    pages: 1,
    total: 0,
  });
  const [tableBusy, setTableBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [regionFilter, setRegionFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const d = await api("owner/overview");
      setData(d);
      setPlans(d.packages);
      setError("");
      setRevision((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (account?.owner) void load();
  }, [account?.owner, load]);
  useEffect(() => {
    setPage(1);
    setQuery("");
    setRegionFilter("");
    setIndustryFilter("");
    setUserStatus("");
  }, [tab]);
  useEffect(() => {
    if (!account?.owner || !["creators", "users"].includes(tab)) return;
    const controller = new AbortController();
    setTableBusy(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        ...(tab === "creators"
          ? { region: regionFilter, industry: industryFilter }
          : { status: userStatus }),
      });
      api(`owner/${tab}?${params}`, { signal: controller.signal })
        .then(setRecords)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setTableBusy(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    account?.owner,
    tab,
    query,
    page,
    regionFilter,
    industryFilter,
    userStatus,
    revision,
  ]);
  const saveCreator = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setModalError("");
    try {
      await api("owner/creators", post(editing));
      notify(
        editing.id ? "Creator details updated." : "A new local voice added.",
      );
      setEditing(null);
      await load();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const readFile = async (f: File) => {
    setBusy(true);
    setModalError("");
    setImportRows([]);
    setPreview(null);
    setLastImport(null);
    try {
      const { readImport } = await import("../lib/import.mjs");
      const rows = await readImport(f);
      const validation = await api("owner/import/preview", post({ rows }));
      setImportRows(rows);
      setPreview(validation);
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async () => {
    setBusy(true);
    setModalError("");
    try {
      const d = await api("owner/import", post({ rows: importRows }));
      notify(
        `${d.added} creators added. ${d.updated} existing profiles updated.`,
      );
      setImportOpen(false);
      setImportRows([]);
      setPreview(null);
      setLastImport(d);
      await load();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const savePlans = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("owner/packages", post({ packages: plans }));
      notify("Membership prices and limits are saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeAccess = async () => {
    setBusy(true);
    setModalError("");
    try {
      await api(
        "owner/access",
        post({
          userId: accessUser.id,
          grant: !(accessUser.accessUntil > Date.now()),
          packageId: selectedPlan,
          reason,
        }),
      );
      notify("Account access updated and recorded.");
      setAccessUser(null);
      await load();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!account?.owner)
    return (
      <div className="content-card empty-state">
        <LockKeyhole size={35} />
        <h2>
          The owner’s <em>studio.</em>
        </h2>
        <p>
          This workspace is reserved for the two authorised administrators. Use
          your invited email and password to manage creators, customers and
          packages.
        </p>
        <a className="button" href="/owner/login">
          Owner sign in{" "}
          <span>
            <ArrowUpRight size={16} />
          </span>
        </a>
        <a href="/brand" className="text-link">
          Back to discovery <ArrowRight size={14} />
        </a>
      </div>
    );
  const users = records.rows;
  const creatorRows = records.rows;
  return (
    <div className="admin-studio">
      <div className="page-title">
        <div>
          <span className="eyebrow">INFLUVIA ADMINISTRATION</span>
          <h1>{ADMIN_LABELS[tab]}</h1>
          <p>
            {
              {
                overview:
                  "Your directory, customers and memberships at a glance.",
                creators:
                  "Manage influencer profiles, photos, rates and collaboration preferences.",
                users: "Every registered account and its membership access.",
                import:
                  "Validate a spreadsheet, review the rows, then publish to discovery.",
                packages:
                  "Set your prices, monthly searches and results per search.",
                audit:
                  "Track imports, profile changes, access changes and exports.",
                invitations:
                  "Invite authorised owners to set their own password and manage access links.",
                payments:
                  "Connect payment providers and manage checkout from your admin studio.",
                finance:
                  "Review payments, reconcile receipts and export your business reports.",
                analytics:
                  "Understand visits, clicks, discovery and the journey to a paid account.",
              }[tab]
            }
          </p>
        </div>
        <div className="admin-actions">
          <button
            className="button outline compact"
            onClick={() => {
              setImportOpen(true);
              setModalError("");
            }}
          >
            <Upload size={15} />
            Import Excel
          </button>
          <button
            className="button compact"
            onClick={() => {
              setEditing({ ...emptyCreator });
              setModalError("");
            }}
          >
            Add influencer{" "}
            <span>
              <Plus size={16} />
            </span>
          </button>
        </div>
      </div>
      <div className="admin-tabs">
        {[
          { id: "overview", label: "Overview" },
          { id: "creators", label: "Influencers" },
          { id: "import", label: "Import Excel" },
          { id: "users", label: "All users" },
          { id: "packages", label: "Packages & limits" },
          { id: "payments", label: "Payment gateways" },
          { id: "finance", label: "Finance" },
          { id: "analytics", label: "Analytics" },
          { id: "audit", label: "Activity & exports" },
          { id: "invitations", label: "Owners & invites" },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              setTab(t.id);
              setQuery("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {tab === "payments" ? (
        <PaymentSettings />
      ) : tab === "finance" ? (
        <FinancePanel />
      ) : tab === "analytics" ? (
        <AnalyticsPanel />
      ) : tab === "invitations" ? (
        <OwnerInvitations />
      ) : !data ? (
        <div className="workspace-skeleton">
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : (
        <>
          {tab === "overview" ? (
            <AdminOverview
              data={data}
              navigate={setTab}
              onAdd={() => {
                setEditing({ ...emptyCreator });
                setModalError("");
              }}
              onImport={() => setTab("import")}
            />
          ) : null}
          {tab === "import" ? (
            <AdminImport
              rows={importRows}
              preview={preview}
              busy={busy}
              error={modalError}
              onRead={readFile}
              onImport={upload}
              success={lastImport}
              onView={() => setTab("creators")}
            />
          ) : null}
          {tab === "creators" || tab === "users" ? (
            <div className="content-card">
              <div className="admin-table-toolbar">
                <div>
                  <h2>
                    {tab === "creators"
                      ? "The creator directory."
                      : "Your community."}
                  </h2>
                  <span>
                    {tab === "creators"
                      ? `${records.total} matching influencer profiles`
                      : `${records.total} matching accounts`}
                  </span>
                </div>
                <label>
                  <Search size={16} />
                  <input
                    placeholder={
                      tab === "creators" ? "Find a creator…" : "Find a user…"
                    }
                    aria-label={
                      tab === "creators" ? "Find an influencer" : "Find a user"
                    }
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </div>
              <div className="admin-data-filters">
                {tab === "creators" ? (
                  <>
                    <label>
                      Region
                      <select
                        value={regionFilter}
                        onChange={(e) => {
                          setRegionFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">All regions</option>
                        {Object.keys(GEOGRAPHY).map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Industry
                      <select
                        value={industryFilter}
                        onChange={(e) => {
                          setIndustryFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">All industries</option>
                        {INDUSTRIES.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <label>
                    Membership status
                    <select
                      value={userStatus}
                      onChange={(e) => {
                        setUserStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All users</option>
                      <option value="paid">Active memberships</option>
                      <option value="free">Free accounts</option>
                      <option value="expired">Expired memberships</option>
                    </select>
                  </label>
                )}
                <button
                  className="admin-inline-action"
                  onClick={() => {
                    setQuery("");
                    setRegionFilter("");
                    setIndustryFilter("");
                    setUserStatus("");
                    setPage(1);
                  }}
                >
                  Clear filters
                </button>
                <button
                  className="icon-button"
                  aria-label="Refresh table"
                  onClick={() => setRevision((x) => x + 1)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    {tab === "creators" ? (
                      <tr>
                        <th>INFLUENCER</th>
                        <th>REGION / CITY</th>
                        <th>INDUSTRY</th>
                        <th>FOLLOWERS</th>
                        <th>RATE</th>
                        <th>COLLABORATION</th>
                        <th />
                      </tr>
                    ) : (
                      <tr>
                        <th>USER</th>
                        <th>BUSINESS</th>
                        <th>PACKAGE</th>
                        <th>ACCESS UNTIL</th>
                        <th>JOINED</th>
                        <th />
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {tableBusy ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="admin-table-loading">
                            <LoaderCircle className="spin" size={18} />
                            Loading records…
                          </div>
                        </td>
                      </tr>
                    ) : tab === "creators" ? (
                      creatorRows.map((c: any) => (
                        <tr key={c.id}>
                          <td>
                            <div className="admin-table-person">
                              <Portrait creator={c} />
                              <div>
                                <b>{c.name}</b>
                                <small>
                                  {c.language}
                                  {!c.photo ? " · Placeholder photo" : ""}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {c.city}
                            <small>
                              {c.district}, {c.region}
                            </small>
                          </td>
                          <td>{c.niche}</td>
                          <td>{compact(c.followers)}</td>
                          <td>{money(c.rate)}</td>
                          <td>
                            {c.acceptsFreeCollab ? (
                              <span className="table-collab">
                                <Gift size={12} />
                                Free collabs
                              </span>
                            ) : (
                              "Paid collaborations"
                            )}
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => {
                                setEditing({ ...c });
                                setModalError("");
                              }}
                            >
                              <Edit3 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      users.map((u: any) => (
                        <tr key={u.id}>
                          <td>
                            <b>{u.name}</b>
                            <small>{u.email}</small>
                          </td>
                          <td>{u.company || "—"}</td>
                          <td>
                            <span
                              className={`plan-pill ${u.accessUntil > Date.now() ? "paid" : ""}`}
                            >
                              {u.accessUntil > Date.now()
                                ? data.packages.find(
                                    (p: any) => p.id === u.packageId,
                                  )?.name || "Active"
                                : u.accessUntil
                                  ? "Expired"
                                  : "Free"}
                            </span>
                          </td>
                          <td>{u.accessUntil ? date(u.accessUntil) : "—"}</td>
                          <td>{date(u.createdAt)}</td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() => {
                                setAccessUser(u);
                                setSelectedPlan(data.packages[0]?.id || "");
                                setReason("");
                                setModalError("");
                              }}
                            >
                              {u.accessUntil > Date.now()
                                ? "Revoke access"
                                : "Activate package"}
                              <ArrowUpRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {!tableBusy &&
                ((tab === "creators" && !creatorRows.length) ||
                  (tab === "users" && !users.length)) ? (
                  <div className="empty-state">
                    <Search size={30} />
                    <h2>
                      No matches, <em>yet.</em>
                    </h2>
                    <p>
                      {tab === "creators"
                        ? "Add a creator manually or import your first Excel spreadsheet."
                        : "Try another name, email or company."}
                    </p>
                  </div>
                ) : null}
              </div>
              <AdminPagination
                page={records.page}
                pages={records.pages}
                total={records.total}
                busy={tableBusy}
                onPage={setPage}
              />
            </div>
          ) : null}
          {tab === "packages" ? (
            <form onSubmit={savePlans} className="package-editor">
              <div className="package-editor-heading">
                <div>
                  <h2>Configure your packages</h2>
                  <p>
                    Set prices in rupees. Choose monthly searches and results
                    per search. Unlimited means no package cap.
                  </p>
                </div>
                <button className="button compact" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Save packages{" "}
                  <span>
                    <ArrowRight size={16} />
                  </span>
                </button>
              </div>
              <div className="package-editor-grid">
                {plans.map((p, i) => (
                  <section
                    className="content-card package-edit-card"
                    key={p.id}
                  >
                    <span className="plan-eyebrow">PACKAGE 0{i + 1}</span>
                    <label>
                      Package name
                      <input
                        required
                        maxLength={50}
                        value={p.name}
                        onChange={(e) =>
                          setPlans((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Description
                      <input
                        maxLength={180}
                        value={p.description}
                        onChange={(e) =>
                          setPlans((s) =>
                            s.map((x, j) =>
                              j === i
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Price per 30 days (₹)
                      <input
                        required
                        type="number"
                        min="1"
                        max="1000000"
                        value={p.price || ""}
                        placeholder="Set your price"
                        onChange={(e) =>
                          setPlans((s) =>
                            s.map((x, j) =>
                              j === i
                                ? { ...x, price: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    {[
                      {
                        key: "searchLimit",
                        label: "Searches per month",
                        fallback: 10,
                        min: 1,
                      },
                      {
                        key: "resultLimit",
                        label: "Results per search",
                        fallback: 200,
                        min: 10,
                      },
                    ].map((f) => (
                      <div className="package-limit" key={f.key}>
                        <label>
                          {f.label}
                          <input
                            disabled={p[f.key] === null}
                            required={p[f.key] !== null}
                            type="number"
                            min={f.min}
                            value={p[f.key] === null ? "" : p[f.key]}
                            placeholder={p[f.key] === null ? "Unlimited" : ""}
                            onChange={(e) =>
                              setPlans((s) =>
                                s.map((x, j) =>
                                  j === i
                                    ? { ...x, [f.key]: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={p[f.key] === null}
                            onChange={(e) =>
                              setPlans((s) =>
                                s.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        [f.key]: e.target.checked
                                          ? null
                                          : f.fallback,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                          Unlimited{" "}
                          {f.key === "resultLimit" ? "· full results" : ""}
                        </label>
                      </div>
                    ))}
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={(e) =>
                          setPlans((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, active: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      Available to customers
                    </label>
                    <div className="package-included">
                      <Check size={14} />
                      Contact unlocks & Excel exports included
                    </div>
                  </section>
                ))}
              </div>
              <div className="package-free-info">
                <LockKeyhole size={17} />
                <p>
                  <b>Free membership stays free.</b> Every free search returns
                  at most 10 results. Social URLs, handles, phone, email and
                  Excel exports remain protected.
                </p>
              </div>
            </form>
          ) : null}
          {tab === "audit" ? (
            <div className="content-card">
              <div className="card-title">
                <h2>Activity & export history</h2>
                <span>Latest 100 events</span>
              </div>
              {!data.audit.length ? (
                <div className="empty-state">
                  <History size={30} />
                  <h2>
                    Every good change,
                    <br />
                    <em>recorded.</em>
                  </h2>
                  <p>
                    Imports, updates, exports and access changes appear here.
                  </p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ACTIVITY</th>
                        <th>DETAILS</th>
                        <th>ACCOUNT</th>
                        <th>DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((a: any) => {
                        const d = JSON.parse(a.details);
                        return (
                          <tr key={a.id}>
                            <td>
                              <b>{a.action.replaceAll("_", " ")}</b>
                            </td>
                            <td>
                              {d.reason ||
                                (a.action === "packages_updated"
                                  ? `${d.packages.length} packages updated`
                                  : d.added !== undefined
                                    ? `${d.added} added · ${d.updated} updated`
                                    : `${d.rowCount || 0} creator rows`)}
                            </td>
                            <td>
                              {data.users.find((u: any) => u.id === a.userId)
                                ?.email || a.userId}
                            </td>
                            <td>{date(a.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
      {editing ? (
        <Dialog
          title={editing.id ? "Edit influencer profile" : "Add influencer"}
          onClose={() => !busy && setEditing(null)}
        >
          <form className="creator-edit-form" onSubmit={saveCreator}>
            {modalError ? (
              <div className="alert error" role="alert">
                {modalError}
              </div>
            ) : null}
            <div className="form-grid">
              <label>
                Influencer name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label>
                Language
                <select
                  value={editing.language}
                  onChange={(e) =>
                    setEditing({ ...editing, language: e.target.value })
                  }
                >
                  {LANGUAGES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Region
                <select
                  value={editing.region}
                  onChange={(e) => {
                    const region = e.target.value,
                      district = Object.keys((GEOGRAPHY as any)[region])[0];
                    setEditing({
                      ...editing,
                      region,
                      district,
                      city: (GEOGRAPHY as any)[region][district][0],
                    });
                  }}
                >
                  {Object.keys(GEOGRAPHY).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                District
                <select
                  value={editing.district}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      district: e.target.value,
                      city:
                        (GEOGRAPHY as any)[editing.region]?.[
                          e.target.value
                        ]?.[0] || e.target.value,
                    })
                  }
                >
                  {Object.keys((GEOGRAPHY as any)[editing.region] || {}).map(
                    (d) => (
                      <option key={d}>{d}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                City
                <input
                  required
                  maxLength={80}
                  value={editing.city}
                  onChange={(e) =>
                    setEditing({ ...editing, city: e.target.value })
                  }
                />
              </label>
              <label>
                Industry
                <select
                  value={editing.niche}
                  onChange={(e) =>
                    setEditing({ ...editing, niche: e.target.value })
                  }
                >
                  {INDUSTRIES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              {[
                { k: "followers", label: "Follower count", max: 1e9 },
                { k: "engagement", label: "Engagement (%)", max: 100 },
                { k: "rate", label: "Indicative rate (₹)", max: 1e8 },
              ].map((f) => (
                <label key={f.k}>
                  {f.label}
                  <input
                    required
                    type="number"
                    min="0"
                    step={f.k === "engagement" ? ".1" : "1"}
                    max={f.max}
                    value={editing[f.k]}
                    onChange={(e) =>
                      setEditing({ ...editing, [f.k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Influencer photo URL
              <input
                type="url"
                value={editing.photo || ""}
                placeholder="https://…/portrait.jpg"
                onChange={(e) =>
                  setEditing({ ...editing, photo: e.target.value })
                }
              />
              <small>
                A labelled placeholder is used when no photo is supplied. Excel
                imports accept a photo column.
              </small>
            </label>
            <div className="form-subheading">
              BUSINESS & SOCIAL DETAILS · PAID ACCESS ONLY
            </div>
            {[
              {
                k: "instagram",
                label: "Instagram profile URL",
                placeholder: "https://www.instagram.com/…",
              },
              {
                k: "youtube",
                label: "YouTube channel URL",
                placeholder: "https://www.youtube.com/@…",
              },
              {
                k: "facebook",
                label: "Facebook profile URL",
                placeholder: "https://www.facebook.com/…",
              },
              {
                k: "email",
                label: "Business email",
                placeholder: "business@creator.com",
              },
              { k: "phone", label: "Business phone", placeholder: "+91 …" },
            ].map((f) => (
              <label key={f.k}>
                {f.label}
                <input
                  type={
                    f.k === "email" ? "email" : f.k === "phone" ? "tel" : "url"
                  }
                  maxLength={f.k === "phone" ? 30 : 500}
                  value={editing[f.k] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setEditing({ ...editing, [f.k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              About / collaboration notes
              <textarea
                maxLength={600}
                value={editing.bio || ""}
                placeholder="The stories they tell, or the collaborations they’re open to…"
                onChange={(e) =>
                  setEditing({ ...editing, bio: e.target.value })
                }
              />
            </label>
            <label className="free-collab-form">
              <Gift size={20} />
              <span>
                <b>Open to free collaborations</b>
                <small>
                  Products, restaurant visits, local experiences, and relevant
                  barter offers.
                </small>
              </span>
              <input
                type="checkbox"
                checked={editing.acceptsFreeCollab}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    acceptsFreeCollab: e.target.checked,
                  })
                }
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              {editing.id ? "Save profile changes" : "Add to directory"}
              <span>
                <ArrowRight size={16} />
              </span>
            </button>
          </form>
        </Dialog>
      ) : null}
      {importOpen ? (
        <Dialog
          title="Bring your local voices in."
          onClose={() => !busy && setImportOpen(false)}
        >
          <AdminImport
            rows={importRows}
            preview={preview}
            busy={busy}
            error={modalError}
            onRead={readFile}
            onImport={upload}
            success={lastImport}
            onView={() => {
              setImportOpen(false);
              setTab("creators");
            }}
          />
        </Dialog>
      ) : null}
      {accessUser ? (
        <Dialog
          title="Manage membership access"
          onClose={() => !busy && setAccessUser(null)}
        >
          <div className="access-dialog">
            <p>
              {accessUser.accessUntil > Date.now()
                ? "Revoke paid access for"
                : "Activate a 30-day package for"}{" "}
              <b>{accessUser.email}</b>.
            </p>
            {modalError ? (
              <div className="alert error" role="alert">
                {modalError}
              </div>
            ) : null}
            {!(accessUser.accessUntil > Date.now()) ? (
              <label>
                Package
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  {data.packages.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Reason for this change
              <textarea
                minLength={5}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Offline payment verified, receipt INV-001"
              />
            </label>
            <small>Access changes are recorded in the activity log.</small>
            <button
              className="button"
              disabled={busy || reason.trim().length < 5}
              onClick={() => void changeAccess()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Confirm change{" "}
              <span>
                <ArrowRight size={16} />
              </span>
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
