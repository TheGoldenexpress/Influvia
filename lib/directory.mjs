export const NICHES = [
  "Food",
  "Fashion",
  "Beauty",
  "Lifestyle",
  "Travel",
  "Fitness",
  "Jewellery",
  "Technology",
];
export const CITIES = [
  "Hyderabad",
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Chennai",
  "Pune",
];
export const LANGUAGES = [
  "English",
  "Hindi",
  "Telugu",
  "Tamil",
  "Kannada",
  "Marathi",
];
export const PHOTOS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=400&h=500&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=500&fit=crop&crop=faces",
];
const seeds = [
  [
    "Aditi Sharma",
    "Food",
    "Hyderabad",
    11400,
    4.8,
    3500,
    "Telugu",
    0,
    "instagram",
  ],
  [
    "Rohan Verma",
    "Fashion",
    "Hyderabad",
    7800,
    5.2,
    2800,
    "Hindi",
    1,
    "youtube",
  ],
  [
    "Meera Nair",
    "Lifestyle",
    "Hyderabad",
    18200,
    4.6,
    5000,
    "English",
    2,
    "instagram",
  ],
  [
    "Arjun Reddy",
    "Fitness",
    "Hyderabad",
    24600,
    6.1,
    6500,
    "Telugu",
    3,
    "youtube",
  ],
  [
    "Sana Khan",
    "Beauty",
    "Hyderabad",
    9200,
    5.8,
    3200,
    "Hindi",
    4,
    "instagram",
  ],
  [
    "Priya Malhotra",
    "Jewellery",
    "Hyderabad",
    14300,
    4.9,
    4200,
    "English",
    5,
    "facebook",
  ],
  [
    "Kavya Rao",
    "Food",
    "Bengaluru",
    8900,
    5.4,
    3200,
    "Kannada",
    2,
    "instagram",
  ],
  [
    "Dev Mehta",
    "Technology",
    "Mumbai",
    38200,
    3.9,
    8500,
    "Hindi",
    1,
    "youtube",
  ],
  [
    "Ananya Iyer",
    "Travel",
    "Chennai",
    12800,
    4.7,
    4000,
    "Tamil",
    0,
    "instagram",
  ],
  ["Vikram Das", "Food", "Hyderabad", 4800, 6.4, 1800, "Telugu", 3, "facebook"],
  [
    "Nisha Patel",
    "Fashion",
    "Pune",
    16800,
    4.2,
    4500,
    "Marathi",
    4,
    "instagram",
  ],
  [
    "Zoya Begum",
    "Jewellery",
    "Hyderabad",
    10500,
    5.1,
    3800,
    "Hindi",
    5,
    "youtube",
  ],
];
export const DEMO_CREATORS = seeds.map((s, i) => ({
  id: `sample-${i + 1}`,
  name: s[0],
  niche: s[1],
  city: s[2],
  followers: s[3],
  engagement: s[4],
  rate: s[5],
  language: s[6],
  photo: PHOTOS[s[7]],
  instagram:
    s[8] === "instagram"
      ? `https://www.instagram.com/sample_creator_${i + 1}/`
      : "",
  youtube:
    s[8] === "youtube"
      ? `https://www.youtube.com/@sample_creator_${i + 1}`
      : "",
  facebook:
    s[8] === "facebook"
      ? `https://www.facebook.com/sample.creator.${i + 1}`
      : "",
  email: `creator${i + 1}@example.invalid`,
  phone: "",
  isDemo: true,
}));
export function parseFilters(input) {
  const get = (k) =>
    String(
      input instanceof URLSearchParams ? input.get(k) || "" : input?.[k] || "",
    ).trim();
  const num = (k, max) => {
    const raw = get(k);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > max)
      throw new Error(`Invalid ${k}`);
    return n;
  };
  const f = {
    q: get("q").slice(0, 100),
    city: get("city"),
    niche: get("niche"),
    platform: get("platform"),
    language: get("language"),
    minFollowers: num("minFollowers", 1e9),
    maxFollowers: num("maxFollowers", 1e9),
    maxRate: num("maxRate", 1e8),
    sort: get("sort") || "recommended",
  };
  if (f.city && !CITIES.includes(f.city)) throw new Error("Invalid city");
  if (f.niche && !NICHES.includes(f.niche)) throw new Error("Invalid niche");
  if (f.language && !LANGUAGES.includes(f.language))
    throw new Error("Invalid language");
  if (f.platform && !["instagram", "youtube", "facebook"].includes(f.platform))
    throw new Error("Invalid platform");
  if (
    ![
      "recommended",
      "followers-desc",
      "followers-asc",
      "rate-asc",
      "name",
    ].includes(f.sort)
  )
    throw new Error("Invalid sort");
  if (
    f.minFollowers !== null &&
    f.maxFollowers !== null &&
    f.minFollowers > f.maxFollowers
  )
    throw new Error("Invalid follower range");
  return f;
}
export function filterSamples(f) {
  const rows = DEMO_CREATORS.filter(
    (c) =>
      (!f.q ||
        `${c.name} ${c.niche} ${c.city}`
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!f.city || c.city === f.city) &&
      (!f.niche || c.niche === f.niche) &&
      (!f.language || c.language === f.language) &&
      (!f.platform || c[f.platform]) &&
      (f.minFollowers === null || c.followers >= f.minFollowers) &&
      (f.maxFollowers === null || c.followers <= f.maxFollowers) &&
      (f.maxRate === null || c.rate <= f.maxRate),
  );
  return rows.sort((a, b) =>
    f.sort === "followers-desc"
      ? b.followers - a.followers
      : f.sort === "followers-asc"
        ? a.followers - b.followers
        : f.sort === "rate-asc"
          ? a.rate - b.rate
          : f.sort === "name"
            ? a.name.localeCompare(b.name)
            : b.engagement - a.engagement,
  );
}
export function hasAccess(account, now = Date.now()) {
  return !!account && Number(account.accessUntil) > now;
}
export function isOwner(email, owners = "") {
  return (
    !!email &&
    owners
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase())
  );
}
export async function verifyHmac(secret, payload, signature) {
  if (!secret || !signature || !/^([a-f\d]{2}){32}$/i.test(signature))
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/.{2}/g), (h) =>
    parseInt(h, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(payload),
  );
}
