"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, post, date } from "./shared";
type Invitation = {
  id: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  acceptedAt: number | null;
  revokedAt: number | null;
};
export function OwnerInvitations() {
  const [data, setData] = useState<{
    owners: { email: string; name: string; enabled: boolean }[];
    invitations: Invitation[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState<{
    url: string;
    email: string;
    expiresAt: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api("owner/invitations"));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const issue = async (email: string) => {
    setBusy(email);
    setError("");
    setLink(null);
    setCopied(false);
    try {
      setLink(await api("owner/invitations", post({ email })));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const revoke = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await api("owner/invitations/revoke", post({ id }));
      setLink(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="owner-invitations">
      <div className="owner-invite-explainer">
        <ShieldCheck size={25} />
        <div>
          <h2>A private invitation. Their own password.</h2>
          <p>
            Share an invitation directly with its named owner. Each link expires
            after 72 hours and works once. Reissuing cancels earlier pending
            links for that email. The owner sets their password when accepting.
          </p>
        </div>
      </div>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {link ? (
        <section
          className="owner-fresh-link"
          aria-label="Private invitation link"
        >
          <button
            className="owner-link-close"
            aria-label="Hide invitation link"
            onClick={() => setLink(null)}
          >
            <X size={16} />
          </button>
          <span className="eyebrow">PRIVATE INVITATION CREATED</span>
          <h3>{link.email}</h3>
          <p>
            Copy this link now and share it privately. It cannot be retrieved
            later. This screen does not send an email.
          </p>
          <div>
            <input
              aria-label="Invitation link"
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="button compact"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  setCopied(true);
                } catch {
                  setError("Select the invitation link and copy it manually.");
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <small>Expires {date(link.expiresAt)}. Keep the link private.</small>
        </section>
      ) : null}
      {!data ? (
        <p role="status">
          <LoaderCircle className="spin" size={16} /> Loading owners…
        </p>
      ) : (
        <>
          <div className="owner-member-grid">
            {data.owners.map((owner) => (
              <article key={owner.email}>
                <span className="owner-member-icon">
                  <Mail size={20} />
                </span>
                <span className="eyebrow">AUTHORISED OWNER</span>
                <h3>{owner.name}</h3>
                <p>{owner.email}</p>
                <span className="owner-invite-status">
                  {owner.enabled
                    ? "Password sign-in active"
                    : "Awaiting invitation activation"}
                </span>
                <button
                  className="button outline compact"
                  disabled={!!busy}
                  onClick={() => void issue(owner.email)}
                >
                  {busy === owner.email ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Link2 size={15} />
                  )}
                  {owner.enabled
                    ? "Create password reset invitation"
                    : "Create invitation"}
                </button>
              </article>
            ))}
          </div>
          <section className="content-card owner-invite-history">
            <h2>Invitation history</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Owner email</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invitations.map((invite) => {
                    const pending =
                      !invite.acceptedAt &&
                      !invite.revokedAt &&
                      invite.expiresAt > Date.now();
                    return (
                      <tr key={invite.id}>
                        <td>{invite.email}</td>
                        <td>{date(invite.createdAt)}</td>
                        <td>{date(invite.expiresAt)}</td>
                        <td>
                          {invite.acceptedAt
                            ? "Accepted"
                            : invite.revokedAt
                              ? "Revoked"
                              : pending
                                ? "Pending"
                                : "Expired"}
                        </td>
                        <td>
                          {pending ? (
                            <button
                              className="text-link"
                              disabled={!!busy}
                              onClick={() => void revoke(invite.id)}
                            >
                              {busy === invite.id ? "Revoking…" : "Revoke link"}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!data.invitations.length ? (
                    <tr>
                      <td colSpan={5}>No invitations yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
