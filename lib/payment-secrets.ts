import { ApiError, runtime } from "./auth";
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key() {
  const value = runtime().PAYMENT_CONFIG_KEY;
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new ApiError(
      503,
      "Payment credential storage is not configured. Please contact the site operator.",
    );
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(value.match(/../g)!, (x) => parseInt(x, 16)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function sealSecrets(
  value: Record<string, string>,
  context: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(context) },
    await key(),
    enc.encode(JSON.stringify(value)),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(data))}`;
}
export async function openSecrets(
  value: string,
  context: string,
): Promise<Record<string, string>> {
  if (!value) return {};
  const [v, iv, data] = value.split(".");
  if (v !== "v1" || !iv || !data)
    throw new ApiError(503, "Payment credentials could not be loaded.");
  try {
    return JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: bytes(iv),
            additionalData: enc.encode(context),
          },
          await key(),
          bytes(data),
        ),
      ),
    );
  } catch {
    throw new ApiError(
      503,
      "Payment credentials could not be decrypted. Please reconfigure this connection.",
    );
  }
}
