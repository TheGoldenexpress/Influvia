"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { api, post, Dialog, date, currencyMoney, type Account } from "./shared";
import { PAYMENT_METHODS, providerById } from "../lib/payment-catalog";
export async function launchApiCheckout(
  d: any,
  onSuccess: () => Promise<void>,
  onError: (s: string) => void,
  onDismiss: () => void,
) {
  if (d.type === "redirect") {
    location.assign(d.url);
    return;
  }
  if (d.type !== "razorpay") return;
  if (!(window as any).Razorpay)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Checkout could not load. Please try again."));
      document.head.appendChild(script);
    });
  new (window as any).Razorpay({
    key: d.key,
    amount: d.amount,
    currency: d.currency,
    order_id: d.remoteId,
    name: "INFLUVIA",
    description: "Creator directory membership · 30 days",
    prefill: { email: d.email },
    theme: { color: "#17171b" },
    handler: async (r: any) => {
      try {
        await api(
          "payments/verify",
          post({
            orderId: d.orderId,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature: r.razorpay_signature,
          }),
        );
        await onSuccess();
      } catch (e) {
        onError((e as Error).message);
      } finally {
        onDismiss();
      }
    },
    modal: { ondismiss: onDismiss },
  }).open();
}
export function CheckoutPanel({
  account,
  packageId,
  onClose,
  refresh,
  notify,
}: {
  account: Account | null;
  packageId: string | null;
  onClose: () => void;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [options, setOptions] = useState<any[]>([]),
    [history, setHistory] = useState<any[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [manual, setManual] = useState<any>(null),
    [reference, setReference] = useState(""),
    [mode, setMode] = useState("live"),
    [loaded, setLoaded] = useState(false);
  const returned = useRef("");
  const loadHistory = async () => {
    if (account) {
      const d = await api("payments/history");
      setHistory(d.orders);
    }
  };
  useEffect(() => {
    const ctrl = new AbortController();
    setLoaded(false);
    api(`payments/options?mode=${mode}`, { signal: ctrl.signal })
      .then((d) => {
        setOptions(d.options.filter((o: any) => o.mode === mode));
        setLoaded(true);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [mode]);
  useEffect(() => {
    if (account) void loadHistory().catch((e) => setError(e.message));
  }, [account?.id]);
  useEffect(() => {
    if (!account) return;
    const params = new URLSearchParams(location.search),
      id = params.get("order");
    if (!id || returned.current === id || params.has("cancelled")) return;
    returned.current = id;
    void api("payments/confirm", post({ orderId: id }))
      .then(async (d) => {
        await refresh();
        await loadHistory();
        notify(
          d.paid
            ? d.test
              ? "Test payment verified. Live access remains unchanged."
              : "Payment confirmed. Your membership is active."
            : d.message,
        );
        historyReplace();
      })
      .catch((e) => setError(e.message));
  }, [account?.id]);
  const paid = async () => {
    await refresh();
    await loadHistory();
    notify(
      mode === "test"
        ? "Test payment verified. Live access remains unchanged."
        : "Payment confirmed. Your membership is active.",
    );
    onClose();
  };
  const choose = async (option: any) => {
    if (!packageId) return;
    setError("");
    setBusy(option.id);
    try {
      const d = await api(
        "payments/order",
        post({ packageId, provider: option.provider, mode: option.mode }),
      );
      if (d.type === "manual") {
        setManual(d);
        setReference("");
        setBusy("");
        onClose();
        await loadHistory();
      } else
        await launchApiCheckout(d, paid, setError, () => {
          setBusy("");
          void loadHistory();
        });
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  };
  const confirm = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const order = history.find((o) => o.id === id);
      if (providerById(order?.provider)?.type !== "api") {
        const d = await api("payments/instructions", post({ orderId: id }));
        setManual(d);
        setReference(order?.receiptReference || "");
        return;
      }
      const d = await api("payments/confirm", post({ orderId: id }));
      await refresh();
      await loadHistory();
      notify(
        d.paid
          ? d.test
            ? "Test payment verified."
            : "Payment confirmed. Membership active."
          : d.message,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {account?.owner ? (
        <div className="checkout-owner-test">
          <label>
            Checkout environment
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="live">Live customer checkout</option>
              <option value="test">Owner test checkout</option>
            </select>
          </label>
          <small>
            Test orders do not activate membership. Configure and enable test
            connections in Payment gateways.
          </small>
        </div>
      ) : null}
      {packageId ? (
        <Dialog title="Choose how to pay" onClose={() => !busy && onClose()}>
          <div className="checkout-choices">
            <p>
              One payment for 30 days of directory access.{" "}
              {mode === "test"
                ? "You are using the owner test environment."
                : ""}
            </p>
            {!loaded ? (
              <LoaderCircle className="spin" />
            ) : (
              options
                .filter((o) =>
                  o.packages.some((m: any) => m.packageId === packageId),
                )
                .map((o) => (
                  <button
                    key={o.id}
                    disabled={!!busy}
                    onClick={() => void choose(o)}
                  >
                    <span className="gateway-logo">
                      {providerById(o.provider)?.initials}
                    </span>
                    <span>
                      <b>{o.name}</b>
                      <small>
                        {o.methods
                          .map((m: string) => PAYMENT_METHODS[m])
                          .join(" · ")}
                      </small>
                      <small>
                        {o.manual
                          ? "Access after owner verifies receipt"
                          : "Payment confirmation required"}
                      </small>
                    </span>
                    {busy === o.id ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </button>
                ))
            )}
            {loaded &&
            !options.some((o) =>
              o.packages.some((m: any) => m.packageId === packageId),
            ) ? (
              <div className="commerce-empty">
                No {mode} payment option is connected to this package yet.
              </div>
            ) : null}
            {error ? (
              <div className="alert error" role="alert">
                {error}
              </div>
            ) : null}
          </div>
        </Dialog>
      ) : null}
      {manual ? (
        <Dialog title="Complete your payment" onClose={() => setManual(null)}>
          <form
            className="commerce-action-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("receipt");
              setError("");
              try {
                await api(
                  "payments/receipt",
                  post({ orderId: manual.orderId, reference }),
                );
                await loadHistory();
                notify(
                  "Receipt submitted. Access opens after payment verification.",
                );
                setManual(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            <span className="commerce-badge">
              {manual.mode.toUpperCase()} ·{" "}
              {providerById(manual.provider)?.name}
            </span>
            <h3>{currencyMoney(manual.amount, manual.currency)}</h3>
            <p className="checkout-instructions">
              {manual.instructions ||
                "Pay the exact amount, keep your receipt and submit its reference below. Access unlocks after verification."}
            </p>
            {manual.upiId ? (
              <div className="upi-payment-details">
                <Smartphone size={23} />
                <b>{manual.payeeName}</b>
                <code>{manual.upiId}</code>
                <button
                  type="button"
                  className="commerce-secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(manual.upiId)
                  }
                >
                  Copy UPI ID <Copy size={12} />
                </button>
                <small>
                  Use any supported UPI app. On desktop, enter the UPI ID in
                  your phone’s payment app.
                </small>
              </div>
            ) : null}
            <label>
              INFLUVIA order reference
              <input readOnly value={manual.orderId} />
              <small>
                Include this reference when paying or in the provider’s order
                reference field.
              </small>
            </label>
            {manual.url ? (
              <a
                className="button compact"
                href={manual.url}
                target={manual.url.startsWith("https:") ? "_blank" : undefined}
                rel="noreferrer"
              >
                {manual.upiId ? "Open UPI app" : "Open secure checkout"}
                <ArrowUpRight size={14} />
              </a>
            ) : null}
            <label>
              Payment receipt / UTR / transaction reference
              <input
                required
                minLength={3}
                maxLength={150}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            {error ? (
              <div className="alert error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="button compact" disabled={!!busy}>
              Submit receipt for verification <Check size={14} />
            </button>
            <small>
              A submitted reference does not activate access until verified.
            </small>
          </form>
        </Dialog>
      ) : null}
      {account ? (
        <section className="admin-panel customer-payment-history">
          <div className="admin-panel-heading">
            <div>
              <span className="eyebrow">YOUR PAYMENTS</span>
              <h2>Payment history</h2>
            </div>
            <button
              className="commerce-icon"
              aria-label="Refresh payment history"
              onClick={() =>
                void loadHistory().catch((e) => setError(e.message))
              }
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {!history.length ? (
            <p>Your membership payments will appear here.</p>
          ) : (
            <div className="commerce-table-wrap">
              <table className="commerce-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <b>{providerById(o.provider)?.name}</b>
                        <small>
                          {o.mode} · {o.id}
                        </small>
                      </td>
                      <td>{date(o.createdAt)}</td>
                      <td>{currencyMoney(o.amount, o.currency)}</td>
                      <td>{o.status.replaceAll("_", " ")}</td>
                      <td>
                        {["created", "awaiting_review"].includes(o.status) ? (
                          <button
                            className="commerce-row-action"
                            disabled={!!busy}
                            onClick={() => void confirm(o.id)}
                          >
                            Check payment
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
          )}
        </section>
      ) : null}
    </>
  );
}
function historyReplace() {
  window.history.replaceState(null, "", "/billing");
}
