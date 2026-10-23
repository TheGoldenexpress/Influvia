"use client";
import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CreditCard,
  Download,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  LockKeyhole,
  Globe,
  Smartphone,
  Wallet,
  Plus,
  RefreshCw,
  LoaderCircle,
  Copy,
  ExternalLink,
  TrendingUp,
  MousePointer2,
  Users,
  Eye,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Receipt,
  X,
} from "lucide-react";
import { api, post, Dialog, date, currencyMoney } from "./shared";
import {
  PROVIDERS,
  PAYMENT_METHODS,
  CURRENCIES,
  providerById,
  type Provider,
  type PaymentConfig,
} from "../lib/payment-catalog";

function useRemote(path: string) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(path, { signal: controller.signal })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error, loading, reload: () => setRevision((x) => x + 1) };
}
function Loading() {
  return (
    <div className="commerce-loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your workspace…
    </div>
  );
}
function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert error" role="alert">
      {children}
    </div>
  );
}
export function PaymentSettings() {
  const { data, error, loading, reload } = useRemote("owner/payments");
  const [mode, setMode] = useState("test"),
    [search, setSearch] = useState(""),
    [region, setRegion] = useState("all"),
    [selected, setSelected] = useState<Provider | null>(null);
  const connections = data?.connections || [],
    enabled = connections.filter(
      (c: any) => c.enabled && c.mode === mode,
    ).length;
  const catalog = PROVIDERS.filter(
    (p) =>
      (region === "all" || p.region.includes(region)) &&
      `${p.name} ${p.methods.map((m) => PAYMENT_METHODS[m]).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="commerce-page">
      <section className="commerce-intro">
        <div>
          <span className="admin-caption">PAYMENT INFRASTRUCTURE</span>
          <h2>
            More ways to pay.
            <br />
            <span>One place to manage.</span>
          </h2>
          <p>
            Connect India and international checkout, set package prices, and
            choose how payments are confirmed.
          </p>
          <div className="commerce-proof">
            <ShieldCheck size={15} /> Encrypted credentials <i /> Owner-only
            settings <i /> Test & live environments
          </div>
        </div>
        <div className="commerce-orbit" aria-hidden="true">
          <div>
            <CreditCard size={30} />
            <b>INFLUVIA</b>
            <small>PAYMENT CONNECTIONS</small>
          </div>
          <span className="orbit-one">
            <Smartphone size={19} />
          </span>
          <span className="orbit-two">
            <Globe size={19} />
          </span>
          <span className="orbit-three">
            <Wallet size={19} />
          </span>
        </div>
      </section>
      <div className="commerce-toolbar">
        <div className="segmented" aria-label="Payment environment">
          {["test", "live"].map((m) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "test" ? "Test environment" : "Live payments"}
            </button>
          ))}
        </div>
        <span className="commerce-count">
          {enabled} enabled · {PROVIDERS.length} options
        </span>
        <button
          className="commerce-icon"
          aria-label="Refresh connections"
          onClick={reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {mode === "test" ? (
        <div className="commerce-notice">
          <ShieldCheck size={18} />
          <p>
            <b>A separate space to test.</b> Test payments never activate a real
            membership or enter live finance totals. Live payment options stay
            hidden until you enable them.
          </p>
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {data && !data.encryptionReady ? (
        <Alert>
          Secure credential storage needs to be configured by the site operator.
        </Alert>
      ) : null}
      <div className="commerce-filter">
        <label>
          <Search size={16} />
          <input
            aria-label="Find a payment provider or method"
            placeholder="Find a provider, UPI, cards, wallets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Provider region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="all">All regions</option>
          <option value="India">India</option>
          <option value="International">International</option>
        </select>
      </div>
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="gateway-grid">
          {catalog.map((p) => {
            const c = connections.find(
              (c: any) => c.provider === p.id && c.mode === mode,
            );
            return (
              <article className="gateway-card" key={p.id}>
                <div className="gateway-card-top">
                  <span className={`gateway-logo provider-${p.id}`}>
                    {p.initials}
                  </span>
                  <span
                    className={`commerce-badge ${c?.enabled ? "success" : ""}`}
                  >
                    {c?.enabled
                      ? "Enabled"
                      : c
                        ? "Saved · disabled"
                        : "Not connected"}
                  </span>
                </div>
                <h3>
                  {p.name}
                  <small>{p.region}</small>
                </h3>
                <p>
                  {p.type === "api"
                    ? "API checkout · server verification"
                    : p.type === "hosted"
                      ? "Hosted checkout · receipt confirmation"
                      : "Manual payment · owner verification"}
                </p>
                <div className="gateway-methods">
                  {p.methods.map((m) => (
                    <span key={m}>{PAYMENT_METHODS[m]}</span>
                  ))}
                </div>
                <button onClick={() => setSelected(p)} disabled={!data}>
                  {c ? "Manage connection" : "Set up connection"}
                  <ArrowUpRight size={16} />
                </button>
              </article>
            );
          })}
        </div>
      )}
      {!catalog.length ? (
        <div className="commerce-empty">
          No payment providers match your search.
        </div>
      ) : null}
      <section className="method-explainer">
        <div>
          <Smartphone size={22} />
          <h3>UPI, your way.</h3>
          <p>
            Razorpay and eligible gateways offer UPI apps. Direct UPI supports a
            business UPI ID and an app payment link, with receipt approval in
            Finance.
          </p>
        </div>
        <div>
          <Wallet size={22} />
          <h3>Apple Pay & Google Pay.</h3>
          <p>
            These are payment methods inside eligible provider checkouts.
            Availability depends on your merchant account, currency, country and
            customer device.
          </p>
        </div>
        <div>
          <LockKeyhole size={22} />
          <h3>Control access with confidence.</h3>
          <p>
            API captures, an authenticated automation, or an owner-verified
            receipt activates a package. Customer claims and return-page visits
            never grant access.
          </p>
        </div>
      </section>
      {selected && data ? (
        <Dialog
          title={`${selected.name} connection`}
          onClose={() => setSelected(null)}
        >
          <GatewayForm
            key={`${selected.id}:${mode}`}
            provider={selected}
            mode={mode}
            saved={connections.find(
              (c: any) => c.provider === selected.id && c.mode === mode,
            )}
            packages={data.packages}
            onSaved={reload}
            onClose={() => setSelected(null)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
function GatewayForm({
  provider: p,
  mode,
  saved,
  packages,
  onSaved,
  onClose,
}: {
  provider: Provider;
  mode: string;
  saved: any;
  packages: any[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const blank: PaymentConfig = {
    currency: p.region === "International" ? "USD" : "INR",
    methods: p.methods,
    fields: {},
    mappings: [],
    fulfillment: "manual",
    instructions: "",
  };
  const [config, setConfig] = useState<PaymentConfig>(saved?.config || blank),
    [enabled, setEnabled] = useState(!!saved?.enabled),
    [secrets, setSecrets] = useState<Record<string, string>>({}),
    [clear, setClear] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [bridgeToken, setBridgeToken] = useState(""),
    [localSaved, setLocalSaved] = useState(saved);
  const field = (key: string, value: string) =>
    setConfig((c) => ({ ...c, fields: { ...c.fields, [key]: value } }));
  const mapping = (id: string, key: string, value: unknown) =>
    setConfig((c) => ({
      ...c,
      mappings: c.mappings.map((m) =>
        m.packageId === id ? { ...m, [key]: value } : m,
      ),
    }));
  const reloadLocal = async () => {
    const d = await api("owner/payments");
    setLocalSaved(
      d.connections.find((c: any) => c.provider === p.id && c.mode === mode),
    );
    onSaved();
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        "owner/payments/save",
        post({
          provider: p.id,
          mode,
          enabled,
          config,
          secrets,
          clearSecrets: clear,
        }),
      );
      setSecrets({});
      setClear([]);
      await reloadLocal();
      setMessage("Connection saved securely.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const d = await api(
        "owner/payments/test",
        post({ provider: p.id, mode }),
      );
      setMessage(d.message);
      await reloadLocal();
    } catch (e) {
      setError((e as Error).message);
      await reloadLocal();
    } finally {
      setBusy(false);
    }
  };
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await api(
        "owner/payments/bridge-secret",
        post({ provider: p.id, mode }),
      );
      setBridgeToken(d.token);
      await reloadLocal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const endpoint =
    typeof window !== "undefined"
      ? `${location.origin}/api/payments/${p.type === "api" ? "webhook" : "bridge"}/${p.id}/${mode}`
      : "";
  return (
    <form className="gateway-form" onSubmit={save}>
      <div className="gateway-form-intro">
        <span className="gateway-logo">{p.initials}</span>
        <div>
          <span className="commerce-badge">
            {mode.toUpperCase()} ENVIRONMENT
          </span>
          <p>{p.note}</p>
          {p.docs ? (
            <a href={p.docs} target="_blank" rel="noreferrer">
              Provider setup documentation <ExternalLink size={12} />
            </a>
          ) : null}
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {message ? (
        <div role="status" className="commerce-notice">
          <Check size={17} />
          {message}
        </div>
      ) : null}
      <div className="commerce-form-section">
        <h3>
          <span>01</span> Account connection
        </h3>
        <div className="commerce-form-grid">
          <label>
            Currency
            <select
              value={config.currency}
              onChange={(e) =>
                setConfig((c) => ({ ...c, currency: e.target.value }))
              }
            >
              {CURRENCIES.filter(
                (c) => !["upi", "razorpay"].includes(p.id) || c === "INR",
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="gateway-validation">
            <ShieldCheck size={19} />
            <div>
              <b>
                {localSaved?.testStatus === "passed"
                  ? "Credentials verified"
                  : localSaved?.testStatus === "validated"
                    ? "Configuration validated"
                    : "Ready when you are"}
              </b>
              <small>
                {localSaved?.testedAt
                  ? `Last checked ${date(localSaved.testedAt)}`
                  : "Save your settings, then run a connection check."}
              </small>
            </div>
          </div>
          {p.fields.map((f) => (
            <label
              key={f.key}
              className={f.key === "instructions" ? "full-width" : ""}
            >
              {f.label}
              {f.secret ? (
                <span className="field-security">
                  <LockKeyhole size={11} />
                  {localSaved?.secretFields.includes(f.key)
                    ? "Saved securely"
                    : "Encrypted on save"}
                </span>
              ) : null}
              {f.key === "instructions" ? (
                <textarea
                  value={config.fields[f.key] || ""}
                  maxLength={1500}
                  onChange={(e) => field(f.key, e.target.value)}
                />
              ) : (
                <input
                  autoComplete="off"
                  type={f.secret ? "password" : "text"}
                  value={
                    f.secret ? secrets[f.key] || "" : config.fields[f.key] || ""
                  }
                  placeholder={
                    f.secret && localSaved?.secretFields.includes(f.key)
                      ? "Leave blank to keep saved credential"
                      : f.hint || f.label
                  }
                  maxLength={2000}
                  onChange={(e) =>
                    f.secret
                      ? setSecrets((s) => ({ ...s, [f.key]: e.target.value }))
                      : field(f.key, e.target.value)
                  }
                />
              )}
              <small>{f.hint}</small>
              {f.secret && localSaved?.secretFields.includes(f.key) ? (
                <span className="commerce-checkbox">
                  <input
                    type="checkbox"
                    checked={clear.includes(f.key)}
                    onChange={(e) =>
                      setClear((c) =>
                        e.target.checked
                          ? [...c, f.key]
                          : c.filter((k) => k !== f.key),
                      )
                    }
                  />{" "}
                  Remove saved credential
                </span>
              ) : null}
            </label>
          ))}
        </div>
      </div>
      <div className="commerce-form-section">
        <h3>
          <span>02</span> Payment methods
        </h3>
        <div className="method-options">
          {p.methods.map((m) => (
            <label key={m}>
              <input
                type="checkbox"
                checked={config.methods.includes(m)}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    methods: e.target.checked
                      ? [...c.methods, m]
                      : c.methods.filter((k) => k !== m),
                  }))
                }
              />
              {PAYMENT_METHODS[m]}
            </label>
          ))}
        </div>
        <small>
          Methods describe your checkout offering. Enable corresponding methods
          in your provider account; its checkout determines final eligibility.
        </small>
      </div>
      <div className="commerce-form-section">
        <h3>
          <span>03</span> Connect your packages
        </h3>
        <p>
          Enter amounts in {config.currency}. INR can use the package price.
          Other currencies need an explicit amount; no currency conversion is
          applied.
        </p>
        {!packages.length ? (
          <div className="commerce-notice">
            Create a package in Packages & limits first. You can save this
            connection as a draft.
          </div>
        ) : (
          packages.map((plan) => {
            const m = config.mappings.find((m) => m.packageId === plan.id);
            return (
              <div className="package-mapping" key={plan.id}>
                <label className="commerce-checkbox">
                  <input
                    type="checkbox"
                    checked={!!m}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        mappings: e.target.checked
                          ? [
                              ...c.mappings,
                              {
                                packageId: plan.id,
                                amountMinor: null,
                                checkoutUrl: "",
                                productId: "",
                              },
                            ]
                          : c.mappings.filter((m) => m.packageId !== plan.id),
                      }))
                    }
                  />
                  <b>{plan.name}</b>
                  <small>{plan.active ? "Active" : "Inactive"}</small>
                </label>
                {m ? (
                  <div className="commerce-form-grid">
                    <label>
                      Amount ({config.currency})
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          m.amountMinor === null ? "" : m.amountMinor / 100
                        }
                        placeholder={
                          config.currency === "INR"
                            ? `${plan.price} · package default`
                            : "Required amount"
                        }
                        onChange={(e) =>
                          mapping(
                            plan.id,
                            "amountMinor",
                            e.target.value === ""
                              ? null
                              : Math.round(Number(e.target.value) * 100),
                          )
                        }
                      />
                    </label>
                    {p.type === "hosted" ? (
                      <>
                        <label>
                          Product / offer ID (optional)
                          <input
                            value={m.productId}
                            onChange={(e) =>
                              mapping(plan.id, "productId", e.target.value)
                            }
                          />
                        </label>
                        <label className="full-width">
                          Hosted checkout URL
                          <input
                            type="url"
                            value={m.checkoutUrl}
                            placeholder={`https://${p.hosts[0]}/…`}
                            onChange={(e) =>
                              mapping(plan.id, "checkoutUrl", e.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {p.type !== "api" ? (
        <div className="commerce-form-section">
          <h3>
            <span>04</span> Confirm payment
          </h3>
          <label>
            Access activation
            <select
              value={config.fulfillment}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  fulfillment: e.target.value as "manual" | "bridge",
                }))
              }
            >
              <option value="manual">Owner verifies receipt in Finance</option>
              <option value="bridge">Authenticated automation bridge</option>
            </select>
          </label>
          <label>
            Customer instructions
            <textarea
              maxLength={1000}
              value={config.instructions}
              onChange={(e) =>
                setConfig((c) => ({ ...c, instructions: e.target.value }))
              }
              placeholder="Explain what reference to enter and when access will be confirmed."
            />
          </label>
          {config.fulfillment === "bridge" ? (
            <div className="automation-setup">
              <p>
                Save disabled first, then generate a secret. In your automation
                tool, send a POST after a verified purchase, with the exact
                INFLUVIA order reference. Provider-native webhook signatures are
                not accepted by this bridge.
              </p>
              <code>{endpoint}</code>
              <button
                type="button"
                className="commerce-secondary"
                disabled={busy || !localSaved}
                onClick={() => void generate()}
              >
                <LockKeyhole size={14} />
                {localSaved?.secretFields.includes("bridgeSecret")
                  ? "Rotate automation secret"
                  : "Generate automation secret"}
              </button>
              {bridgeToken ? (
                <label>
                  Copy now — shown only this session
                  <input readOnly type="text" value={bridgeToken} />
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(bridgeToken)
                    }
                  >
                    Copy secret <Copy size={12} />
                  </button>
                </label>
              ) : null}
              <small>Header: Authorization: Bearer YOUR_SECRET</small>
              <pre>
                {JSON.stringify(
                  {
                    orderId: "INFLUVIA_ORDER_UUID",
                    paymentId: "UNIQUE_PROVIDER_RECEIPT",
                    amountMinor: 199900,
                    currency: config.currency,
                    status: "paid",
                  },
                  null,
                  2,
                )}
              </pre>
              <p>
                The amount and currency must match the order. Map refunds and
                subscription expiry to your own owner review; this bridge
                confirms individual 30-day purchases.
              </p>
            </div>
          ) : null}
        </div>
      ) : p.id !== "paypal" ? (
        <div className="commerce-form-section">
          <h3>
            <span>04</span> Payment notifications
          </h3>
          <p>
            Add this webhook URL in your provider dashboard.{" "}
            {p.id === "stripe"
              ? "Subscribe to checkout.session.completed and checkout.session.async_payment_succeeded."
              : "Subscribe to payment.captured."}{" "}
            Save the webhook signing secret above.
          </p>
          <code className="endpoint-code">{endpoint}</code>
        </div>
      ) : (
        <div className="commerce-notice">
          PayPal uses verified server capture when the buyer returns. The buyer
          can also confirm payment from their payment history.
        </div>
      )}
      <div className="gateway-enable">
        <div>
          <b>Enable {mode === "live" ? "live payments" : "test checkout"}</b>
          <p>
            {mode === "live"
              ? "Show this option to customers for mapped packages."
              : "Allow owner test orders. Real customer access stays locked."}
          </p>
        </div>
        <label className="commerce-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span />
          <small>{enabled ? "Enabled" : "Disabled"}</small>
        </label>
      </div>
      <div className="gateway-form-footer">
        <button
          type="button"
          className="commerce-secondary"
          disabled={busy || !localSaved}
          onClick={() => void test()}
        >
          <RefreshCw size={14} />
          {p.type === "api"
            ? "Test saved credentials"
            : "Validate saved settings"}
        </button>
        <button className="button compact" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <ShieldCheck size={15} />
          )}
          Save connection <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="commerce-text-button"
          disabled={busy}
          onClick={onClose}
        >
          Done
        </button>
      </div>
      <small>
        For API connections: save disabled → test credentials → enable and save.
        Changed credentials or settings require another test. A credential check
        does not test an actual payment.
      </small>
    </form>
  );
}

function today() {
  return new Date(Date.now() + 19800000).toISOString().slice(0, 10);
}
function initialDates() {
  return {
    start: new Date(Date.now() + 19800000 - 29 * 86400000)
      .toISOString()
      .slice(0, 10),
    end: today(),
  };
}
function ReportDates({
  value,
  onChange,
}: {
  value: { start: string; end: string };
  onChange: (v: { start: string; end: string }) => void;
}) {
  return (
    <div className="report-dates">
      <select
        aria-label="Report period"
        defaultValue="30"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (n)
            onChange({
              start: new Date(Date.now() + 19800000 - (n - 1) * 86400000)
                .toISOString()
                .slice(0, 10),
              end: today(),
            });
        }}
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="0">Custom dates</option>
      </select>
      <label>
        <span>From</span>
        <input
          type="date"
          aria-label="Report start date"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          aria-label="Report end date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </label>
      <small>IST</small>
    </div>
  );
}
async function downloadReport(path: string) {
  const response = await fetch("/api/" + path);
  if (!response.ok) {
    const b = (await response.json()) as { error?: string };
    throw new Error(b.error || "Export failed.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = path.includes("finance")
    ? "influvia-finance.xlsx"
    : "influvia-analytics.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="commerce-metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Trend({
  rows,
  start,
  end,
  series,
  currency,
}: {
  rows: any[];
  start: string;
  end: string;
  series: { key: string; label: string }[];
  currency?: string;
}) {
  const days = [];
  for (
    let d = Date.parse(start);
    d <= Date.parse(end) && days.length < 93;
    d += 86400000
  )
    days.push(new Date(d).toISOString().slice(0, 10));
  const data = days.map((day) => ({
      day,
      ...(rows.find((r) => r.day === day) || {}),
    })),
    max = Math.max(
      1,
      ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
    );
  return (
    <div className="commerce-chart">
      <div className="chart-legend">
        {series.map((s, i) => (
          <span key={s.key}>
            <i className={`series-${i}`} />
            {s.label}
          </span>
        ))}
        <small>{currency ? currency : "Events"}</small>
      </div>
      <svg
        viewBox="0 0 800 220"
        role="img"
        aria-label={`Daily ${series.map((s) => s.label).join(", ")}`}
      >
        <title>
          Daily activity from {start} to {end}
        </title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="48"
              y1={185 - t * 150}
              x2="785"
              y2={185 - t * 150}
              stroke="#e9e9ed"
              strokeDasharray="3 4"
            />
            <text x="3" y={189 - t * 150} fontSize="10" fill="#7b7b85">
              {currency
                ? Math.round((max * t) / 100).toLocaleString()
                : Math.round(max * t)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={i === 0 ? "#18181d" : "#aaaab3"}
              strokeWidth={i === 0 ? "2.7" : "2"}
              points={data
                .map(
                  (d, j) =>
                    `${48 + (j / Math.max(1, data.length - 1)) * 737},${185 - ((Number(d[s.key]) || 0) / max) * 150}`,
                )
                .join(" ")}
            />
            {data.map((d, j) => (
              <circle
                key={d.day}
                cx={48 + (j / Math.max(1, data.length - 1)) * 737}
                cy={185 - ((Number(d[s.key]) || 0) / max) * 150}
                r="3"
                fill={i === 0 ? "#18181d" : "#aaaab3"}
              >
                <title>
                  {d.day}: {s.label}{" "}
                  {currency
                    ? currencyMoney(d[s.key] || 0, currency)
                    : d[s.key] || 0}
                </title>
              </circle>
            ))}
          </g>
        ))}
        <text x="48" y="215" fontSize="10" fill="#7b7b85">
          {start}
        </text>
        <text x="785" y="215" textAnchor="end" fontSize="10" fill="#7b7b85">
          {end}
        </text>
      </svg>
    </div>
  );
}
function RankList({
  rows,
  empty = "Activity will appear here as customers use the website.",
}: {
  rows: any[];
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.length ? (
    <div className="rank-list">
      {rows.map((r) => (
        <div key={r.name}>
          <div>
            <span>{r.name || "Other"}</span>
            <b>{r.count.toLocaleString()}</b>
          </div>
          <div className="rank-track">
            <i style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="commerce-empty">{empty}</div>
  );
}

export function FinancePanel() {
  const [dates, setDates] = useState(initialDates),
    [currency, setCurrency] = useState("INR"),
    [mode, setMode] = useState("live"),
    [status, setStatus] = useState(""),
    [provider, setProvider] = useState(""),
    [page, setPage] = useState(1),
    [entry, setEntry] = useState(false),
    [review, setReview] = useState<any>(null),
    [refund, setRefund] = useState<any>(null),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false),
    [voidEntry, setVoidEntry] = useState<any>(null);
  const params = new URLSearchParams({
      ...dates,
      currency,
      mode,
      status,
      provider,
      page: String(page),
    }),
    {
      data,
      error: loadError,
      loading,
      reload,
    } = useRemote(`owner/finance?${params}`);
  const changeDates = (v: typeof dates) => {
    setDates(v);
    setPage(1);
  };
  const exportFile = async () => {
    setExporting(true);
    setError("");
    try {
      await downloadReport(`owner/finance/export?${params}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="commerce-page">
      <div className="report-heading">
        <div>
          <span className="admin-caption">YOUR BUSINESS, IN NUMBERS</span>
          <h2>Finance overview.</h2>
          <p>
            Payments, receipt reviews and a clear record of business income and
            expenses.
          </p>
        </div>
        <div>
          <button className="commerce-secondary" onClick={() => setEntry(true)}>
            <Plus size={15} /> Add book entry
          </button>
          <button
            className="button compact"
            disabled={exporting || !data}
            onClick={() => void exportFile()}
          >
            <Download size={15} />
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>
      <div className="report-controls">
        <ReportDates value={dates} onChange={changeDates} />
        <select
          aria-label="Finance currency"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setPage(1);
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Finance environment"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setPage(1);
          }}
        >
          <option value="live">Live payments</option>
          <option value="test">Test payments</option>
        </select>
        <button
          className="commerce-icon"
          onClick={reload}
          aria-label="Refresh finance"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error || loadError ? <Alert>{error || loadError}</Alert> : null}
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <div className="commerce-metrics">
            <Metric
              label="Collected"
              value={currencyMoney(data.summary.collected, currency)}
              note={`${data.summary.paidCount || 0} confirmed payments`}
              icon={<CreditCard size={17} />}
            />
            <Metric
              label="Pending payments"
              value={currencyMoney(data.summary.pending, currency)}
              note={`${data.summary.reviewCount || 0} receipts awaiting review`}
              icon={<Receipt size={17} />}
            />
            <Metric
              label="Expenses & fees"
              value={currencyMoney(
                (data.summary.expenses || 0) + (data.summary.fees || 0),
                currency,
              )}
              note="Recorded book entries in this period"
              icon={<FileSpreadsheet size={17} />}
            />
            <Metric
              label="Recorded net activity"
              value={currencyMoney(data.summary.net, currency)}
              note="After recorded refunds, expenses & fees"
              icon={<TrendingUp size={17} />}
            />
          </div>
          <div className="finance-secondary-metrics">
            <span>
              Refunds on selected orders{" "}
              <b>{currencyMoney(data.summary.refunded, currency)}</b>
            </span>
            <span>
              Other recorded income{" "}
              <b>{currencyMoney(data.summary.income, currency)}</b>
            </span>
            <span>
              Mode <b>{mode.toUpperCase()}</b>
            </span>
          </div>
          <section className="admin-panel commerce-chart-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">PAYMENT ACTIVITY</span>
                <h3>Collected less recorded refunds</h3>
              </div>
              <span className="commerce-badge">{currency} · by order date</span>
            </div>
            <Trend
              rows={data.daily}
              start={dates.start}
              end={dates.end}
              series={[{ key: "collected", label: "Net payments" }]}
              currency={currency}
            />
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">TRANSACTION REGISTER</span>
                <h3>Every payment, accounted for.</h3>
              </div>
              <b>{data.total} orders</b>
            </div>
            <div className="finance-table-filters">
              <select
                aria-label="Filter provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All providers</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter payment status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="paid">Paid</option>
                <option value="awaiting_review">Needs review</option>
                <option value="created">Created</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
              </select>
              <small>Filters apply to payment totals, chart and export.</small>
            </div>
            <div className="commerce-table-wrap">
              <table className="commerce-table">
                <thead>
                  <tr>
                    <th>Customer / order</th>
                    <th>Provider</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((o: any) => (
                    <tr key={o.id}>
                      <td>
                        <b>{o.name}</b>
                        <small>{o.email}</small>
                        <code>{o.id}</code>
                        {o.receiptReference ? (
                          <small>Claim: {o.receiptReference}</small>
                        ) : null}
                      </td>
                      <td>
                        {providerById(o.provider)?.name || o.provider}
                        <small>{o.mode}</small>
                      </td>
                      <td>{date(o.createdAt)}</td>
                      <td>
                        <b>{currencyMoney(o.amount, o.currency)}</b>
                        {o.refundedAmount > 0 ? (
                          <small>
                            Refund recorded{" "}
                            {currencyMoney(o.refundedAmount, o.currency)}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`commerce-badge ${o.status === "paid" ? "success" : ""}`}
                        >
                          {o.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        {["created", "awaiting_review"].includes(o.status) &&
                        providerById(o.provider)?.type !== "api" ? (
                          <button
                            className="commerce-row-action"
                            onClick={() => setReview(o)}
                          >
                            Review <ArrowUpRight size={13} />
                          </button>
                        ) : o.status === "paid" &&
                          o.refundedAmount < o.amount ? (
                          <button
                            className="commerce-row-action"
                            onClick={() => setRefund(o)}
                          >
                            Record refund
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length ? (
              <div className="commerce-empty">
                <CreditCard size={25} />
                <b>No payments in this view.</b>
                <p>
                  Confirmed checkouts and receipt claims will appear here. Try
                  another period or currency.
                </p>
              </div>
            ) : null}
            <div className="report-pagination">
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous payment page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= data.pages || loading}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next payment page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">BUSINESS BOOK</span>
                <h3>Income, expenses & fees</h3>
              </div>
              <span className="commerce-badge">
                Date & currency filters · {data.entries.length} recent entries
              </span>
            </div>
            <div className="commerce-table-wrap">
              <table className="commerce-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e: any) => (
                    <tr key={e.id}>
                      <td>
                        <b>{e.description}</b>
                        <small>
                          {e.kind}
                          {e.voidedAt ? " · VOID" : ""}
                        </small>
                      </td>
                      <td>{e.category}</td>
                      <td>{date(e.occurredAt)}</td>
                      <td>{currencyMoney(e.amount, e.currency)}</td>
                      <td>{e.reference || "—"}</td>
                      <td>
                        {!e.voidedAt ? (
                          <button
                            className="commerce-row-action"
                            onClick={() => setVoidEntry(e)}
                          >
                            Void entry
                          </button>
                        ) : (
                          "Voided"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.entries.length ? (
              <div className="commerce-empty">
                {mode === "test"
                  ? "Real business book entries stay outside the test environment."
                  : "Add operating expenses, fees or other income to keep a useful business record."}
              </div>
            ) : null}
          </section>
          <p className="report-footnote">
            Amounts stay separate by currency. Payment reports use order
            creation dates; refunds are recorded against those orders. Recorded
            net activity is not a settled bank balance. Provider fees and
            payouts require your own reconciliation. Refund recording does not
            send money.
          </p>
        </>
      ) : null}
      {entry ? (
        <Dialog
          title="Add a business book entry"
          onClose={() => setEntry(false)}
        >
          <BookEntry
            currency={currency}
            onSaved={() => {
              setEntry(false);
              reload();
            }}
          />
        </Dialog>
      ) : null}
      {review ? (
        <Dialog title="Verify payment receipt" onClose={() => setReview(null)}>
          <FinanceAction
            order={review}
            kind="review"
            onSaved={() => {
              setReview(null);
              reload();
            }}
          />
        </Dialog>
      ) : null}
      {refund ? (
        <Dialog
          title="Record an existing refund"
          onClose={() => setRefund(null)}
        >
          <FinanceAction
            order={refund}
            kind="refund"
            onSaved={() => {
              setRefund(null);
              reload();
            }}
          />
        </Dialog>
      ) : null}
      {voidEntry ? (
        <Dialog title="Void a book entry" onClose={() => setVoidEntry(null)}>
          <VoidEntry
            entry={voidEntry}
            onSaved={() => {
              setVoidEntry(null);
              reload();
            }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
function BookEntry({
  currency,
  onSaved,
}: {
  currency: string;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        "owner/finance/entry",
        post({
          ...Object.fromEntries(form),
          amount: Math.round(Number(form.get("amount")) * 100),
        }),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <form className="commerce-action-form" onSubmit={submit}>
      {error ? <Alert>{error}</Alert> : null}
      <div className="commerce-form-grid">
        <label>
          Type
          <select name="kind">
            <option value="expense">Expense</option>
            <option value="fee">Provider / bank fee</option>
            <option value="income">Other income</option>
          </select>
        </label>
        <label>
          Currency
          <select name="currency" defaultValue={currency}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            name="amount"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required
          />
        </label>
        <label>
          Date
          <input name="date" type="date" defaultValue={today()} required />
        </label>
        <label>
          Category
          <input
            name="category"
            placeholder="Hosting, marketing, fees…"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          Receipt / reference
          <input name="reference" maxLength={150} />
        </label>
        <label className="full-width">
          Description
          <textarea name="description" minLength={3} maxLength={300} required />
        </label>
      </div>
      <small>
        Customer membership payments already in the payment register should not
        be entered again as income.
      </small>
      <button className="button compact" disabled={busy}>
        Save book entry <Check size={15} />
      </button>
    </form>
  );
}
function FinanceAction({
  order,
  kind,
  onSaved,
}: {
  order: any;
  kind: "review" | "refund";
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(
        `owner/finance/${kind === "review" ? "reconcile" : "refund"}`,
        post({
          orderId: order.id,
          ...Object.fromEntries(f),
          ...(kind === "refund"
            ? { amount: Math.round(Number(f.get("amount")) * 100) }
            : {}),
        }),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <form className="commerce-action-form" onSubmit={submit}>
      <p>
        <b>{order.email}</b>
        <br />
        {currencyMoney(order.amount, order.currency)} ·{" "}
        {providerById(order.provider)?.name}
      </p>
      <p>
        {kind === "review"
          ? "Check the payment in your merchant or bank account. Approve only when the receipt, amount and customer match. Approval grants 30 days of access for live orders."
          : "Process the refund in your provider account first, then record it here. A full recorded refund revokes the access granted by this order."}
      </p>
      {error ? <Alert>{error}</Alert> : null}
      {kind === "review" ? (
        <label>
          Decision
          <select name="action">
            <option value="approve">Payment verified — approve</option>
            <option value="reject">Payment not verified — reject</option>
          </select>
        </label>
      ) : (
        <label>
          Refund amount ({order.currency})
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={(order.amount - order.refundedAmount) / 100}
            defaultValue={(order.amount - order.refundedAmount) / 100}
            required
          />
        </label>
      )}
      <label>
        {kind === "review"
          ? "Verified payment ID / bank receipt reference"
          : "Provider refund reference"}
        <input
          name={kind === "review" ? "paymentId" : "reference"}
          minLength={3}
          maxLength={150}
          required
        />
      </label>
      <label>
        Reason / verification notes
        <textarea name="reason" minLength={5} maxLength={300} required />
      </label>
      <button className="button compact" disabled={busy}>
        {kind === "review" ? "Confirm review" : "Record refund"}
        <Check size={15} />
      </button>
    </form>
  );
}
function VoidEntry({ entry, onSaved }: { entry: any; onSaved: () => void }) {
  const [error, setError] = useState("");
  return (
    <form
      className="commerce-action-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await api(
            "owner/finance/void",
            post({ id: entry.id, reason: f.get("reason") }),
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p>
        Void “{entry.description}”. The original record remains in your exported
        book and activity log.
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <label>
        Reason
        <textarea name="reason" minLength={5} maxLength={300} required />
      </label>
      <button className="button compact">Void entry</button>
    </form>
  );
}

export function AnalyticsPanel() {
  const [dates, setDates] = useState(initialDates),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  const params = new URLSearchParams(dates),
    {
      data,
      error: loadError,
      loading,
      reload,
    } = useRemote(`owner/analytics?${params}`);
  const count = (k: string) =>
      data?.counts.find((c: any) => c.kind === k)?.count || 0,
    sessionCount = (k: string) =>
      data?.counts.find((c: any) => c.kind === k)?.sessions || 0;
  const views = count("page_view"),
    visits = data?.summary?.sessions || 0,
    purchases = count("purchase"),
    conversion = visits
      ? ((sessionCount("purchase") / visits) * 100).toFixed(1)
      : "0.0";
  const exportFile = async () => {
    setExporting(true);
    setError("");
    try {
      await downloadReport(`owner/analytics/export?${params}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="commerce-page">
      <div className="report-heading">
        <div>
          <span className="admin-caption">UNDERSTAND YOUR AUDIENCE</span>
          <h2>
            From first visit
            <br />
            <span>to paid membership.</span>
          </h2>
          <p>
            See what people explore, where they arrive, and where they stop.
          </p>
        </div>
        <button
          className="button compact"
          disabled={exporting || !data}
          onClick={() => void exportFile()}
        >
          <Download size={15} />
          {exporting ? "Exporting…" : "Export analytics"}
        </button>
      </div>
      <div className="report-controls">
        <ReportDates value={dates} onChange={setDates} />
        <button
          aria-label="Refresh analytics"
          className="commerce-icon"
          onClick={reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error || loadError ? <Alert>{error || loadError}</Alert> : null}
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <div className="commerce-metrics">
            <Metric
              label="Visit sessions"
              value={visits.toLocaleString()}
              note="30-minute browser visits"
              icon={<Users size={17} />}
            />
            <Metric
              label="Page views"
              value={views.toLocaleString()}
              note={`${count("click")} measured clicks`}
              icon={<Eye size={17} />}
            />
            <Metric
              label="Creator searches"
              value={count("search").toLocaleString()}
              note={`${count("export")} Excel exports`}
              icon={<Search size={17} />}
            />
            <Metric
              label="Purchase conversion"
              value={`${conversion}%`}
              note={`${purchases} tracked live purchases`}
              icon={<TrendingUp size={17} />}
            />
          </div>
          <section className="admin-panel commerce-chart-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">DAILY MOMENTUM</span>
                <h3>How people use INFLUVIA</h3>
              </div>
              <span className="commerce-badge">Live activity · IST</span>
            </div>
            <Trend
              rows={data.days}
              start={dates.start}
              end={dates.end}
              series={[
                { key: "views", label: "Page views" },
                { key: "searches", label: "Searches" },
              ]}
            />
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">CONVERSION JOURNEY</span>
                <h3>Where interest becomes intent.</h3>
              </div>
              <MousePointer2 size={19} />
            </div>
            <div className="conversion-funnel">
              {[
                { name: "Visited", kind: "page_view" },
                { name: "Registered", kind: "registration" },
                { name: "Signed in", kind: "sign_in" },
                { name: "Searched", kind: "search" },
                { name: "Checkout", kind: "checkout" },
                { name: "Purchased", kind: "purchase" },
              ].map((s, i) => (
                <div key={s.kind}>
                  <span>
                    0{i + 1} / {s.name}
                  </span>
                  <strong>{sessionCount(s.kind).toLocaleString()}</strong>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, (sessionCount(s.kind) / Math.max(1, visits)) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>sessions</small>
                </div>
              ))}
            </div>
            <small className="report-footnote">
              Stage counts are independent session totals, not a strict
              sequential funnel. Returning customers can skip registration or
              sign-in during a visit.
            </small>
          </section>
          <div className="analytics-two-col">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="admin-caption">DESTINATIONS</span>
                  <h3>Most visited pages</h3>
                </div>
                <Eye size={18} />
              </div>
              <RankList rows={data.pages} />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="admin-caption">ACQUISITION</span>
                  <h3>Where visitors come from</h3>
                </div>
                <Globe size={18} />
              </div>
              <RankList rows={data.sources} />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="admin-caption">ENGAGEMENT</span>
                  <h3>Top clicks</h3>
                </div>
                <MousePointer2 size={18} />
              </div>
              <RankList rows={data.clicks} />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <span className="admin-caption">BROWSING</span>
                  <h3>Devices & sharing</h3>
                </div>
                <Smartphone size={18} />
              </div>
              <RankList rows={data.devices} />
              <div className="analytics-share-stat">
                <span>Creator shares / link copies</span>
                <b>{count("share")}</b>
              </div>
            </section>
          </div>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-caption">
                  INTEREST WITHOUT A PURCHASE
                </span>
                <h3>Signed in. Still exploring.</h3>
              </div>
              <span className="commerce-badge">
                {data.summary?.signedInWithoutPurchase || 0} accounts
              </span>
            </div>
            <p className="commerce-panel-copy">
              Users who signed in during this period and have no live paid
              order. Review their experience and pricing journey.
            </p>
            <div className="commerce-table-wrap">
              <table className="commerce-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Latest sign-in</th>
                    <th>Purchase history</th>
                  </tr>
                </thead>
                <tbody>
                  {data.nonbuyers.map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <b>{u.name}</b>
                      </td>
                      <td>{u.email}</td>
                      <td>{date(u.lastSignIn)}</td>
                      <td>
                        <span className="commerce-badge">No paid order</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.nonbuyers.length ? (
              <div className="commerce-empty">No matching accounts yet.</div>
            ) : null}
            <small className="report-footnote">
              Showing up to 100 most recent matching accounts. This view does
              not send messages.
            </small>
          </section>
          <p className="report-footnote">
            Tracking begins with this release and retains events for 93 days.
            Owner activity, Do Not Track, Global Privacy Control and opted-out
            visits are excluded. Sessions are not unique people, and blocked
            tracking can reduce measured activity. Finance remains the source of
            truth for all confirmed payments.
          </p>
        </>
      ) : null}
    </div>
  );
}
