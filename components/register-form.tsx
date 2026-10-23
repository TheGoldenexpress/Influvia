"use client";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { api, post } from "./shared";
export function RegistrationForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        "auth/register",
        post({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
        }),
      );
      window.location.assign("/brand");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form className="reference-register-form" onSubmit={submit}>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      <label>
        Full name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder="Your name"
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          placeholder="you@yourbusiness.com"
        />
      </label>
      <label>
        Password
        <div className="reference-password">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            placeholder="At least 10 characters"
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
      <button className="v3-button" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={17} /> : null}Create free
        account
        <span>
          <ArrowUpRight size={18} />
        </span>
      </button>
      <p>
        By registering, you agree to our <a href="/terms">Terms</a> and{" "}
        <a href="/privacy">Privacy policy</a>.
      </p>
      <div className="reference-register-login">
        Already registered?{" "}
        <a href="/login">
          Log in <ArrowUpRight size={13} />
        </a>
      </div>
      <a className="reference-more-auth" href="/join">
        More registration options <ArrowUpRight size={12} />
      </a>
    </form>
  );
}
