"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  LockKeyhole,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  Gift,
  FileSpreadsheet,
  LoaderCircle,
  Mail,
  Phone,
  Check,
  LayoutGrid,
  List,
  ExternalLink,
  RefreshCw,
  Eye,
  Globe,
  Users,
  Share2,
} from "lucide-react";
import {
  GEOGRAPHY,
  INDUSTRIES,
  LANGUAGES,
  EMPTY_FILTERS,
  parseSearchFilters,
  sampleSearch,
} from "../lib/catalog.mjs";
import {
  Portrait,
  Platform,
  Dialog,
  api,
  post,
  money,
  compact,
  type Creator,
  type Account,
} from "./shared";
import { track } from "./analytics-tracker";
type Filters = typeof EMPTY_FILTERS;
const CreatorGallery = dynamic(() => import("./creator-gallery"), {
  ssr: false,
  loading: () => (
    <div className="gallery-loading">Preparing the creator gallery…</div>
  ),
});
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {children}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}
export function Directory({
  account,
  demo,
  notify,
  refresh,
}: {
  account: Account | null;
  demo: boolean;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersReady, setFiltersReady] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<string[]>([]);
  const [samplePaid, setSamplePaid] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profile, setProfile] = useState<Creator | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [list, setList] = useState(false);
  const [gallery, setGallery] = useState(true);
  const initialSearch = useRef("");
  const paid = demo ? samplePaid : !!account?.paid;
  const queryAllowed = demo || !!account;
  const set = (k: string, v: string) =>
    setFilters((f) => ({
      ...f,
      [k]: v,
      ...(k === "region"
        ? { district: "", city: "" }
        : k === "district"
          ? { city: "" }
          : {}),
    }));
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters((f) => ({
      ...f,
      ...Object.fromEntries(
        [...params.entries()].filter(([k]) => k in EMPTY_FILTERS),
      ),
    }));
    setFiltersReady(true);
  }, []);
  const search = async () => {
    if (!queryAllowed) {
      window.location.href = "/join";
      return;
    }
    setLoading(true);
    setError("");
    setSelection([]);
    setPage(1);
    try {
      if (demo) {
        const data = sampleSearch(parseSearchFilters(filters), samplePaid);
        setResult({
          ...data,
          available: data.rows.length,
          pages: Math.max(1, Math.ceil(data.rows.length / 12)),
          page: 1,
          paid: samplePaid,
          filters: { ...filters },
        });
      } else {
        const data = await api("search", post({ filters }));
        setResult(data);
        await refresh();
      }
      setFiltersOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (
      filtersReady &&
      !demo &&
      account?.id &&
      initialSearch.current !== account.id
    ) {
      initialSearch.current = account.id;
      void search();
    }
  }, [account?.id, filtersReady]);
  useEffect(() => {
    if (demo) {
      const params = new URLSearchParams(window.location.search);
      const f = {
        ...EMPTY_FILTERS,
        ...Object.fromEntries(
          [...params.entries()].filter(([k]) => k in EMPTY_FILTERS),
        ),
      };
      const data = sampleSearch(parseSearchFilters(f), samplePaid);
      setResult({
        ...data,
        available: data.rows.length,
        pages: Math.max(1, Math.ceil(data.rows.length / 12)),
        page: 1,
        paid: samplePaid,
        filters: f,
      });
      setSelection([]);
      setPage(1);
    }
  }, [demo, samplePaid]);
  const paginate = async (next: number) => {
    setSelection([]);
    if (demo) {
      setPage(next);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api(`search?id=${result.searchId}&page=${next}`);
      setResult(data);
      setPage(data.page);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const rows: Creator[] = result
    ? demo
      ? result.rows.slice((page - 1) * 12, page * 12)
      : result.rows
    : [];
  const districts = filters.region
    ? Object.keys(GEOGRAPHY[filters.region as keyof typeof GEOGRAPHY] || {})
    : [];
  const cities =
    filters.region && filters.district
      ? (GEOGRAPHY as any)[filters.region]?.[filters.district] || []
      : [];
  const exportFile = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/${demo ? "demo/export" : "exports"}`,
        post(
          demo
            ? { filters: result.filters, ids: selection }
            : { searchId: result.searchId, ids: selection },
        ),
      );
      if (!response.ok) throw new Error(((await response.json()) as any).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `influvia-${demo ? "sample-" : ""}creators.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setExportOpen(false);
      notify("Your Excel file is ready. A good shortlist goes a long way.");
    } catch (e) {
      setError((e as Error).message);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR NEXT GOOD FIT IS OUT THERE.</span>
          <h1>
            Find your <em>people.</em>
          </h1>
          <p>Local voices. A few good filters. Endless possibilities.</p>
        </div>
        <button
          className="button compact"
          disabled={!paid || !result?.available || loading}
          onClick={() => setExportOpen(true)}
        >
          {paid ? <Download size={16} /> : <LockKeyhole size={16} />}Export to
          Excel{" "}
          <span>
            <ArrowUpRight size={15} />
          </span>
        </button>
      </div>
      {result?.sample ? (
        <div className="catalog-sample-note">
          <span>Sample directory</span>100 illustrative profiles. Uploaded
          influencer records appear here as the owner adds them.
        </div>
      ) : null}
      {demo ? (
        <div className="sample-workspace-note">
          <span>
            <Eye size={16} />
            <b>Sample workspace</b> · Fictional profiles, full product
            experience.
          </span>
          <div className="segmented">
            <button
              className={!samplePaid ? "active" : ""}
              onClick={() => setSamplePaid(false)}
            >
              Free preview
            </button>
            <button
              className={samplePaid ? "active" : ""}
              onClick={() => setSamplePaid(true)}
            >
              Paid view
            </button>
          </div>
        </div>
      ) : !paid ? (
        <div className="free-access-banner">
          <span className="free-banner-icon">
            <LockKeyhole size={21} />
          </span>
          <div>
            <b>Your curiosity is on the house.</b>
            <p>
              Free accounts see 10 results per search. Upgrade to reveal social
              profiles, phone numbers, email, and Excel exports.
            </p>
          </div>
          <a href={account ? "/billing" : "/join"}>
            {account ? "Unlock more" : "Join for free"}
            <ArrowUpRight size={17} />
          </a>
        </div>
      ) : (
        <div className="usage-banner">
          <span>
            <i />
            {account?.plan?.name} membership
          </span>
          <p>
            {account?.plan?.searchLimit === null
              ? "Unlimited searches. Room for every possibility."
              : `${account?.searchesUsed || 0} of ${account?.plan?.searchLimit} searches used this month`}
          </p>
          <span>
            {account?.plan?.resultLimit === null
              ? "Full results"
              : `${account?.plan?.resultLimit} results / search`}
          </span>
        </div>
      )}
      <div className="directory-search-bar">
        <Search size={21} />
        <input
          aria-label="Search creators by name or keyword"
          placeholder="A name, a niche, a new possibility…"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <button
          className="filter-mobile-toggle"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={17} />
          Filters
        </button>
        <button
          className="button compact"
          onClick={() => void search()}
          disabled={loading}
        >
          {loading ? <LoaderCircle className="spin" size={16} /> : null}Search
          creators{" "}
          <span>
            <ArrowRight size={16} />
          </span>
        </button>
      </div>
      <div className="discovery-layout">
        <aside className={`filter-rail ${filtersOpen ? "filters-open" : ""}`}>
          <div className="filter-rail-title">
            <span>
              <SlidersHorizontal size={16} />A little more specific
            </span>
            <button
              aria-label="Close filters"
              className="icon-button"
              onClick={() => setFiltersOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <Select
            label="Region"
            value={filters.region}
            onChange={(v) => set("region", v)}
          >
            <option value="">All regions</option>
            {Object.keys(GEOGRAPHY).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select
            label="District"
            value={filters.district}
            onChange={(v) => set("district", v)}
          >
            <option value="">Whole region</option>
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select
            label="City"
            value={filters.city}
            onChange={(v) => set("city", v)}
          >
            <option value="">All cities</option>
            {cities.map((c: string) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <div className="filter-separator" />
          <Select
            label="Industry"
            value={filters.industry}
            onChange={(v) => set("industry", v)}
          >
            <option value="">All industries</option>
            {INDUSTRIES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
          <Select
            label="Language"
            value={filters.language}
            onChange={(v) => set("language", v)}
          >
            <option value="">Any language</option>
            {LANGUAGES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
          <Select
            label="Platform"
            value={filters.platform}
            onChange={(v) => set("platform", v)}
          >
            <option value="">All platforms</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
          </Select>
          <div className="range-filter">
            <span>Follower count</span>
            <div>
              <input
                aria-label="Minimum followers"
                type="number"
                min="0"
                placeholder="From"
                value={filters.minFollowers}
                onChange={(e) => set("minFollowers", e.target.value)}
              />
              <span>—</span>
              <input
                aria-label="Maximum followers"
                type="number"
                min="0"
                placeholder="To"
                value={filters.maxFollowers}
                onChange={(e) => set("maxFollowers", e.target.value)}
              />
            </div>
          </div>
          <div className="range-filter">
            <span>Indicative price (₹)</span>
            <div>
              <input
                aria-label="Minimum price"
                type="number"
                min="0"
                placeholder="From"
                value={filters.minRate}
                onChange={(e) => set("minRate", e.target.value)}
              />
              <span>—</span>
              <input
                aria-label="Maximum price"
                type="number"
                min="0"
                placeholder="To"
                value={filters.maxRate}
                onChange={(e) => set("maxRate", e.target.value)}
              />
            </div>
          </div>
          <label className="collab-toggle">
            <Gift size={17} />
            <span>
              Open to free collabs<small>Dinners, products & experiences</small>
            </span>
            <input
              type="checkbox"
              checked={filters.collab === "free"}
              onChange={(e) => set("collab", e.target.checked ? "free" : "")}
            />
          </label>
          <button
            className="button filter-apply"
            disabled={loading}
            onClick={() => void search()}
          >
            Apply filters{" "}
            <span>
              <ArrowRight size={15} />
            </span>
          </button>
          <button
            className="reset-filter"
            onClick={() => setFilters({ ...EMPTY_FILTERS, region: "" })}
          >
            Clear all filters
          </button>
          <small className="filter-help">
            {paid && !demo && account?.plan?.searchLimit !== null
              ? "Each submitted search uses one search from your monthly package."
              : "Specific filters make better shortlists."}
          </small>
        </aside>
        <section className="directory-results">
          <div className="results-heading">
            <span>
              {result ? (
                <>
                  <b>{result.available}</b> creators{" "}
                  {result.total > result.available ? (
                    <small>
                      of {result.total} matching ·{" "}
                      {paid ? "package limit" : "free preview"}
                    </small>
                  ) : (
                    <small>ready for discovery</small>
                  )}
                </>
              ) : (
                <>
                  <b>Your next discovery</b>
                  <small>Make it a good one.</small>
                </>
              )}
            </span>
            <div>
              <select
                aria-label="Sort creators"
                value={filters.sort}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="followers-desc">Most followers</option>
                <option value="followers-asc">Fewest followers</option>
                <option value="rate-asc">Lowest price</option>
                <option value="name">Name A–Z</option>
              </select>
              <button
                className="icon-button"
                aria-label="Share filtered creator search"
                onClick={async () => {
                  const target = new URL("/brand", location.origin);
                  const current = result?.filters || filters;
                  for (const [key, value] of Object.entries(current))
                    if (value !== "" && value !== null && value !== undefined)
                      target.searchParams.set(key, String(value));
                  try {
                    if (navigator.share)
                      await navigator.share({
                        title: "Discover creators on INFLUVIA",
                        url: target.toString(),
                      });
                    else {
                      await navigator.clipboard.writeText(target.toString());
                      notify("Search link copied.");
                    }
                    track("share", "Filtered creator search");
                  } catch (e) {
                    if ((e as Error).name !== "AbortError")
                      notify("The link could not be shared. Please try again.");
                  }
                }}
              >
                <Share2 size={17} />
              </button>
              {result?.searchId ? (
                <button
                  className="icon-button"
                  aria-label="Refresh results"
                  title="Refresh this search without using another search"
                  disabled={loading}
                  onClick={() => void paginate(page)}
                >
                  <RefreshCw size={17} />
                </button>
              ) : null}
              <button
                className={`icon-button ${gallery ? "view-active" : ""}`}
                aria-label="Show 3D gallery"
                aria-pressed={gallery}
                onClick={() => setGallery(true)}
              >
                <Users size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={
                  gallery || list ? "Show card view" : "Show list view"
                }
                onClick={() => {
                  if (gallery) {
                    setGallery(false);
                    setList(false);
                  } else setList(!list);
                }}
              >
                {gallery || list ? (
                  <LayoutGrid size={18} />
                ) : (
                  <List size={18} />
                )}
              </button>
            </div>
          </div>
          {error ? (
            <div className="alert error" role="alert">
              {error}
            </div>
          ) : null}
          {selection.length ? (
            <div className="selection-bar">
              <span>
                <Check size={14} />
                {selection.length} creators selected
              </span>
              <button onClick={() => setSelection([])}>
                Clear selection <X size={12} />
              </button>
            </div>
          ) : null}
          {loading ? (
            <div
              className="creator-skeleton-grid"
              aria-label="Finding creators"
            >
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          ) : !result ? (
            <div className="search-welcome">
              <span>✳</span>
              <h2>
                Your people are
                <br />
                <em>closer than you think.</em>
              </h2>
              <p>
                Choose a region, set your filters, and start exploring.
                <br />
                Free accounts get 10 results per search.
              </p>
              {!account && !demo ? (
                <a className="button" href="/join">
                  Create your free account{" "}
                  <span>
                    <ArrowUpRight size={16} />
                  </span>
                </a>
              ) : null}
              <div>
                <MapPin size={15} />
                Telangana <span>·</span>
                <Users size={15} />
                Local creators <span>·</span>
                <Gift size={15} />
                Free collabs
              </div>
            </div>
          ) : !rows.length ? (
            <div className="search-welcome">
              <Search size={34} />
              <h2>
                A little wider,
                <br />
                <em>perhaps?</em>
              </h2>
              <p>
                No creators match these filters. Try another district or
                industry.
                <br />
                Live records appear as your administrator adds them.
              </p>
              <button
                className="button outline"
                onClick={() => setFilters({ ...EMPTY_FILTERS, region: "" })}
              >
                Reset filters{" "}
                <span>
                  <RefreshCw size={15} />
                </span>
              </button>
              <a href="/demo" className="text-link">
                Explore the sample directory <ArrowUpRight size={14} />
              </a>
            </div>
          ) : gallery ? (
            <CreatorGallery creators={rows} onOpen={setProfile} compact />
          ) : (
            <div className={`creator-card-grid ${list ? "list-view" : ""}`}>
              {rows.map((c) => (
                <article className="creator-card" key={c.id}>
                  <div className="creator-card-image">
                    <button
                      className="profile-image-button"
                      onClick={() => setProfile(c)}
                      aria-label={`View ${c.name}`}
                    >
                      <Portrait creator={c} />
                    </button>
                    {paid ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={selection.includes(c.id)}
                        onChange={() =>
                          setSelection((s) =>
                            s.includes(c.id)
                              ? s.filter((id) => id !== c.id)
                              : [...s, c.id],
                          )
                        }
                      />
                    ) : (
                      <span className="card-lock">
                        <LockKeyhole size={13} />
                      </span>
                    )}
                    {c.acceptsFreeCollab ? (
                      <span className="free-collab-chip">
                        <Gift size={12} />
                        Open to free collabs
                      </span>
                    ) : null}
                    {c.isDemo ? (
                      <span className="card-sample">SAMPLE</span>
                    ) : !c.photo ? (
                      <span className="card-sample">PLACEHOLDER IMAGE</span>
                    ) : null}
                  </div>
                  <div className="creator-card-content">
                    <div className="card-niche-platforms">
                      <span>{c.niche}</span>
                      <div>
                        {(c.platforms || []).map((p) => (
                          <Platform type={p} key={p} />
                        ))}
                      </div>
                    </div>
                    <button
                      className="creator-name"
                      onClick={() => setProfile(c)}
                    >
                      <h3>{c.name}</h3>
                      <ArrowUpRight size={17} />
                    </button>
                    <span className="creator-location">
                      <MapPin size={11} />
                      {c.city}, {c.region}
                      <i>·</i>
                      {c.language}
                    </span>
                    <div className="creator-metrics">
                      <span>
                        <b>{compact(c.followers)}</b>
                        <small>Followers</small>
                      </span>
                      <span>
                        <b>{c.engagement}%</b>
                        <small>Engagement</small>
                      </span>
                      <span>
                        <b>{money(c.rate)}</b>
                        <small>Indicative / post</small>
                      </span>
                    </div>
                    {paid ? (
                      <button
                        className="details-unlocked"
                        onClick={() => setProfile(c)}
                      >
                        View profile & business details <ArrowRight size={13} />
                      </button>
                    ) : (
                      <a
                        className="protected-contacts"
                        href={demo ? "/join" : "/billing"}
                        aria-label="Upgrade to reveal contact details"
                      >
                        <span
                          className="blurred-placeholder"
                          aria-hidden="true"
                        >
                          hello@creatordomain.com
                        </span>
                        <span>
                          <LockKeyhole size={12} />
                          Unlock contact details
                        </span>
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {result?.available > 0 ? (
            <div className="results-pagination">
              <span>
                Showing {(page - 1) * 12 + 1}–
                {Math.min(page * 12, result.available)} of {result.available}
                {!paid ? " free results" : ""}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => void paginate(page - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <b>{page}</b>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={page >= result.pages || loading}
                  onClick={() => void paginate(page + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          ) : null}
          {!paid && result?.available ? (
            <div className="results-upgrade">
              <span>There’s more to this story.</span>
              <h3>Go from discovery to your next shortlist.</h3>
              <p>
                Unlock more results, social URLs, phone, email, and filtered
                Excel exports.
              </p>
              <a href={demo ? "/join" : "/billing"} className="button">
                See membership options{" "}
                <span>
                  <ArrowUpRight size={16} />
                </span>
              </a>
            </div>
          ) : null}
        </section>
      </div>
      {profile ? (
        <Dialog title={profile.name} onClose={() => setProfile(null)}>
          <div className="profile-dialog">
            <div className="profile-header">
              <Portrait creator={profile} />
              <div>
                <span>{profile.niche}</span>
                <h3>
                  {profile.city}, {profile.region}
                </h3>
                <p>
                  {profile.language} · {compact(profile.followers)} followers
                </p>
                {profile.acceptsFreeCollab ? (
                  <span className="free-collab-chip">
                    <Gift size={12} />
                    Open to free collaborations
                  </span>
                ) : null}
              </div>
            </div>
            <p>{profile.bio || "Find your next local voice."}</p>
            <div className="profile-business">
              <h3>Business details</h3>
              {paid ? (
                <>
                  <div>
                    <Mail size={15} />
                    {profile.email || "Not provided"}
                  </div>
                  <div>
                    <Phone size={15} />
                    {profile.phone || "Not provided"}
                  </div>
                  <div className="social-profile-links">
                    {(["instagram", "youtube", "facebook"] as const)
                      .filter((k) => profile[k])
                      .map((k) =>
                        profile.isDemo ? (
                          <span key={k}>
                            <Platform type={k} />
                            {k} · fictional sample
                          </span>
                        ) : (
                          <a
                            href={profile[k]}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={k}
                          >
                            <Platform type={k} />
                            {k}
                            <ExternalLink size={12} />
                          </a>
                        ),
                      )}
                  </div>
                </>
              ) : (
                <div className="profile-locked">
                  <LockKeyhole size={24} />
                  <b>A good connection starts with a membership.</b>
                  <p>
                    Business contacts and social URLs are available with a paid
                    package.
                  </p>
                  <a className="button" href="/billing">
                    Unlock profile details{" "}
                    <span>
                      <ArrowUpRight size={15} />
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      ) : null}
      {exportOpen ? (
        <Dialog
          title="Your next shortlist, to go."
          onClose={() => !exporting && setExportOpen(false)}
        >
          <div className="export-dialog">
            <span className="export-icon">
              <FileSpreadsheet size={32} />
            </span>
            <h3>
              {selection.length || result.available} {demo ? "sample " : ""}
              creators. One useful spreadsheet.
            </h3>
            <p>
              Your current search filters and package limits apply. Includes
              profiles, metrics, collaboration options, social URLs, and
              available business details.
            </p>
            {demo ? (
              <small>Fictional sample data, not for outreach.</small>
            ) : null}
            <button
              className="button"
              onClick={() => void exportFile()}
              disabled={exporting}
            >
              {exporting ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Download size={17} />
              )}
              {exporting ? "Preparing your Excel…" : "Download Excel"}
              <span>
                <ArrowDownIcon />
              </span>
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
function ArrowDownIcon() {
  return <Download size={16} />;
}
