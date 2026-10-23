"use client";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Users,
  Upload,
  Download,
  Plus,
  ShieldCheck,
  FileSpreadsheet,
  Camera,
  Mail,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Activity,
  MapPin,
} from "lucide-react";
import { Portrait, date, money, compact, type Creator } from "./shared";

export const ADMIN_ROUTES: Record<string, string> = {
  overview: "/owner",
  creators: "/owner/influencers",
  import: "/owner/import",
  users: "/owner/users",
  packages: "/owner/packages",
  payments: "/owner/payments",
  finance: "/owner/finance",
  analytics: "/owner/analytics",
  audit: "/owner/activity",
  invitations: "/owner/invitations",
};
export const ADMIN_LABELS: Record<string, string> = {
  overview: "Overview",
  creators: "Influencers",
  import: "Import influencers",
  users: "Users & access",
  packages: "Packages & limits",
  payments: "Payment gateways",
  finance: "Finance",
  analytics: "Website analytics",
  audit: "Activity log",
  invitations: "Owners & invites",
};
export const adminTabFor = (path: string) =>
  Object.keys(ADMIN_ROUTES).find((k) => ADMIN_ROUTES[k] === path) || "overview";

export function AdminOverview({
  data,
  navigate,
  onAdd,
  onImport,
}: {
  data: any;
  navigate: (tab: string) => void;
  onAdd: () => void;
  onImport: () => void;
}) {
  const active = data.users.filter(
    (u: any) => u.accessUntil > Date.now() && u.packageId,
  ).length;
  const total = data.totalCreators || 0;
  const stats = data.stats || {};
  return (
    <div className="admin-dashboard">
      <div className="admin-metric-grid">
        {[
          {
            label: "Influencer profiles",
            value: total,
            note: "Live directory",
            icon: <Users />,
          },
          {
            label: "Registered users",
            value: data.users.length,
            note: `${active} active memberships`,
            icon: <ShieldCheck />,
          },
          {
            label: "Searches this month",
            value: stats.monthSearches || 0,
            note: `${stats.monthExports || 0} Excel exports`,
            icon: <Search />,
          },
          {
            label: "INR net payments",
            value: money(data.revenue || 0),
            note: "Live INR payments less recorded refunds",
            icon: <FileSpreadsheet />,
          },
        ].map((k) => (
          <div className="admin-metric" key={k.label}>
            <div>
              <span>{k.label}</span>
              {k.icon}
            </div>
            <strong>{k.value}</strong>
            <small>{k.note}</small>
          </div>
        ))}
      </div>
      <div className="admin-dashboard-top">
        <section className="admin-welcome-panel">
          <span className="admin-caption">DIRECTORY OPERATIONS</span>
          <h2>
            Your directory.
            <br />
            <span>Under control.</span>
          </h2>
          <p>
            Add local voices, keep their details current, and manage the access
            your customers need.
          </p>
          <div>
            <button onClick={onAdd}>
              <Plus size={16} />
              Add influencer
            </button>
            <button onClick={onImport}>
              <Upload size={16} />
              Import Excel
            </button>
          </div>
          <div className="admin-welcome-foot">
            <ShieldCheck size={14} />
            <span>Owner access · All changes recorded</span>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-caption">PROFILE COMPLETENESS</span>
              <h2>Keep the details useful.</h2>
            </div>
            <Camera size={19} />
          </div>
          <div className="admin-quality-list">
            {[
              {
                label: "Profiles with a photo",
                value: stats.withPhotos || 0,
                icon: <Camera size={16} />,
              },
              {
                label: "Profiles with email or phone",
                value: stats.withContacts || 0,
                icon: <Mail size={16} />,
              },
              {
                label: "Open to free collaborations",
                value: stats.freeCollabs || 0,
                icon: <Check size={16} />,
              },
            ].map((s) => (
              <div key={s.label}>
                <div>
                  {s.icon}
                  <span>{s.label}</span>
                  <b>
                    {s.value} / {total}
                  </b>
                </div>
                <div className="admin-meter">
                  <i
                    style={{ width: `${total ? (s.value / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            className="admin-inline-action"
            onClick={() => navigate("creators")}
          >
            Review influencer details
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <div className="admin-dashboard-middle">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-caption">YOUR CATALOG</span>
              <h2>Industry coverage</h2>
            </div>
            <Users size={19} />
          </div>
          {!total ? (
            <div className="admin-empty-small">
              <Users size={26} />
              <p>
                Import your first influencers to see your directory coverage.
              </p>
            </div>
          ) : (
            <div className="admin-industry-list">
              {(stats.industries || []).map((s: any) => (
                <div key={s.name}>
                  <div>
                    <span>{s.name}</span>
                    <b>{s.count}</b>
                  </div>
                  <div className="admin-meter">
                    <i style={{ width: `${(s.count / total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="admin-region-chips">
            {(stats.districts || []).slice(0, 4).map((s: any) => (
              <span key={s.name}>
                <MapPin size={11} />
                {s.name}
                <b>{s.count}</b>
              </span>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-caption">LATEST UPDATES</span>
              <h2>Recently added or edited</h2>
            </div>
            <button
              aria-label="View all influencers"
              onClick={() => navigate("creators")}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          {!total ? (
            <div className="admin-empty-small">
              <Plus size={26} />
              <p>
                Your live catalog is empty. Sample profiles stay separate from
                admin records.
              </p>
              <button onClick={onAdd}>
                Add your first influencer
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="admin-recent-people">
              {data.creators.slice(0, 4).map((c: Creator) => (
                <div key={c.id}>
                  <Portrait creator={c} />
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.niche} · {c.city}
                    </small>
                  </div>
                  <span>
                    {compact(c.followers)}
                    <small>followers</small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="admin-caption">ACCOUNTABILITY</span>
            <h2>Recent activity</h2>
          </div>
          <button
            className="admin-inline-action"
            onClick={() => navigate("audit")}
          >
            View log
            <ArrowUpRight size={15} />
          </button>
        </div>
        {!data.audit.length ? (
          <div className="admin-empty-small">
            <Activity size={24} />
            <p>
              Imports, profile edits, membership changes and exports will appear
              here.
            </p>
          </div>
        ) : (
          <div className="admin-recent-events">
            {data.audit.slice(0, 5).map((e: any) => {
              let d: any = {};
              try {
                d = JSON.parse(e.details);
              } catch {}
              return (
                <div key={e.id}>
                  <span className="admin-event-icon">
                    <Activity size={15} />
                  </span>
                  <div>
                    <b>{e.action.replaceAll("_", " ")}</b>
                    <small>
                      {d.reason ||
                        (d.added !== undefined
                          ? `${d.added} profiles added · ${d.updated} updated`
                          : d.rowCount !== undefined
                            ? `${d.rowCount} rows exported`
                            : "Configuration updated")}
                    </small>
                  </div>
                  <time>{date(e.createdAt)}</time>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminImport({
  rows,
  preview,
  busy,
  error,
  onRead,
  onImport,
  success,
  onView,
}: {
  rows: any[];
  preview: any;
  busy: boolean;
  error: string;
  onRead: (file: File) => Promise<void>;
  onImport: () => Promise<void>;
  success: any;
  onView: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState(false),
    [csv, setCsv] = useState("");
  const [dragging, setDragging] = useState(false);
  return (
    <div className="admin-import-center">
      <div className="admin-import-steps">
        {[
          "Choose spreadsheet",
          "Validate & review",
          "Publish to directory",
        ].map((s, i) => (
          <div
            className={
              (rows.length && i < 2) || success
                ? "is-complete"
                : i === 0
                  ? "is-current"
                  : ""
            }
            key={s}
          >
            <span>
              {(rows.length && i === 0) || success ? (
                <Check size={14} />
              ) : (
                i + 1
              )}
            </span>
            {s}
          </div>
        ))}
      </div>
      {success ? (
        <div className="admin-import-success" role="status">
          <Check size={22} />
          <div>
            <b>Import complete</b>
            <p>
              {success.added} influencers added. {success.updated} existing
              profiles updated.
            </p>
          </div>
          <button onClick={onView}>
            View influencers
            <ArrowUpRight size={15} />
          </button>
        </div>
      ) : null}
      <div className="admin-import-layout">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-caption">BULK UPLOAD</span>
              <h2>Bring your influencers in.</h2>
            </div>
            <FileSpreadsheet size={21} />
          </div>
          <p className="admin-muted">
            Upload new profiles or update existing records using an ID or
            matching social URL. Review the result before publishing.
          </p>
          <button
            className={`admin-upload-area ${dragging ? "is-dragging" : ""}`}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void onRead(file);
            }}
          >
            <span>
              {busy ? (
                <LoaderCircle className="spin" size={27} />
              ) : (
                <Upload size={27} />
              )}
            </span>
            <b>
              {busy
                ? "Validating your spreadsheet…"
                : "Drop your Excel file here"}
            </b>
            <small>or click to choose a file</small>
            <em>.xlsx or .csv · up to 500 rows · 2 MB</em>
          </button>
          <input
            type="file"
            accept=".xlsx,.csv"
            hidden
            ref={fileRef}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRead(f);
              e.target.value = "";
            }}
          />
          <div className="admin-import-options">
            <a href="/creator-import-template.csv" download>
              <Download size={14} />
              Download CSV template
            </a>
            <button onClick={() => setPaste(!paste)}>
              {paste ? "Hide pasted data" : "Paste CSV instead"}
            </button>
          </div>
          {paste ? (
            <div className="admin-paste">
              <label>
                Paste a CSV header and influencer rows
                <textarea
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder="name,region,district,city,niche,language,followers,rate"
                  rows={5}
                />
              </label>
              <button
                className="button compact"
                disabled={busy || !csv.trim()}
                onClick={() =>
                  void onRead(
                    new File([csv], "pasted-influencers.csv", {
                      type: "text/csv",
                    }),
                  )
                }
              >
                Validate pasted data
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="alert error" role="alert">
              {error}
            </div>
          ) : null}
        </section>
        <aside className="admin-panel admin-import-guide">
          <span className="admin-caption">BEFORE YOU UPLOAD</span>
          <h3>
            A clean spreadsheet.
            <br />A useful directory.
          </h3>
          <ol>
            <li>
              <b>Start with the template</b>
              <p>
                Keep the header row and place your data in the first worksheet.
              </p>
            </li>
            <li>
              <b>Include the essentials</b>
              <p>
                name, region, district, city, niche, language, followers, rate
              </p>
            </li>
            <li>
              <b>Add optional details</b>
              <p>
                id, photo, instagram, youtube, facebook, email, phone,
                engagement, bio, acceptsFreeCollab
              </p>
            </li>
          </ol>
          <div>
            <ShieldCheck size={17} />
            <p>
              Contact information is visible to paid customers. Missing photos
              use labelled placeholders. Updates preserve photos when the photo
              column is omitted.
            </p>
          </div>
        </aside>
      </div>
      {rows.length && preview ? (
        <section className="admin-panel admin-import-review">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-caption">VALIDATED PREVIEW</span>
              <h2>{rows.length} profiles ready to import</h2>
            </div>
            <button
              className="button compact"
              disabled={busy}
              onClick={() => void onImport()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Check size={15} />
              )}
              Confirm import
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="admin-import-counts">
            <span>
              <b>{preview.added}</b> new profiles
            </span>
            <span>
              <b>{preview.updated}</b> existing profiles to update
            </span>
            <span>
              <ShieldCheck size={14} />
              No changes made yet
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>CITY</th>
                  <th>INDUSTRY</th>
                  <th>LANGUAGE</th>
                  <th>FOLLOWERS</th>
                  <th>RATE</th>
                  <th>PHOTO</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((c, i) => (
                  <tr key={i}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>{c.city}</td>
                    <td>{c.niche}</td>
                    <td>{c.language}</td>
                    <td>{c.followers.toLocaleString()}</td>
                    <td>{money(c.rate)}</td>
                    <td>{c.photo ? "Photo URL" : "Placeholder"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 ? (
            <p className="admin-muted">
              Showing 20 of {rows.length} validated rows. All {rows.length} rows
              will be imported.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function AdminPagination({
  page,
  pages,
  total,
  busy,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  busy: boolean;
  onPage: (n: number) => void;
}) {
  return (
    <div className="admin-pagination">
      <span>
        {total
          ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total}`
          : "0 records"}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          aria-label="Next page"
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
