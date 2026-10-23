export const INDUSTRIES = [
  "Food blogger",
  "Real estate",
  "Clothing",
  "General",
];
export const LANGUAGES = ["Telugu", "Urdu", "Hindi", "English"];
export const GEOGRAPHY = {
  Telangana: {
    Hyderabad: ["Hyderabad", "Secunderabad"],
    Nizamabad: ["Nizamabad", "Armoor", "Bodhan"],
    Sangareddy: ["Sangareddy", "Patancheru", "Zaheerabad"],
    Warangal: ["Warangal", "Hanamkonda"],
    Karimnagar: ["Karimnagar", "Huzurabad"],
    Khammam: ["Khammam", "Madhira"],
    Nalgonda: ["Nalgonda", "Miryalaguda"],
    Siddipet: ["Siddipet", "Gajwel"],
    Medak: ["Medak", "Toopran"],
    Rangareddy: ["Shamshabad", "Chevella"],
    "Medchal–Malkajgiri": ["Medchal", "Malkajgiri"],
    Adilabad: ["Adilabad"],
    Mahabubnagar: ["Mahabubnagar"],
  },
  "Andhra Pradesh": {
    Visakhapatnam: ["Visakhapatnam"],
    Vijayawada: ["Vijayawada"],
    Guntur: ["Guntur"],
    Tirupati: ["Tirupati"],
  },
  Karnataka: { Bengaluru: ["Bengaluru"], Mysuru: ["Mysuru"] },
  Maharashtra: { Mumbai: ["Mumbai"], Pune: ["Pune"] },
  Delhi: { Delhi: ["New Delhi"] },
  "Tamil Nadu": { Chennai: ["Chennai"] },
};
export const PACKAGE_DRAFTS = [
  {
    id: "basic",
    name: "Basic",
    description: "For focused local discovery.",
    price: 0,
    searchLimit: 10,
    resultLimit: 200,
    active: true,
    configured: false,
  },
  {
    id: "studio",
    name: "Studio",
    description: "For teams that never stop discovering.",
    price: 0,
    searchLimit: null,
    resultLimit: null,
    active: true,
    configured: false,
  },
];
export const EMPTY_FILTERS = {
  q: "",
  region: "Telangana",
  district: "",
  city: "",
  industry: "",
  platform: "",
  language: "",
  minFollowers: "",
  maxFollowers: "",
  minRate: "",
  maxRate: "",
  collab: "",
  sort: "recommended",
};
export function parseSearchFilters(input) {
  const get = (k) =>
    String(
      input instanceof URLSearchParams ? input.get(k) || "" : input?.[k] || "",
    ).trim();
  const num = (k) => {
    const s = get(k);
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 1e9)
      throw new Error(`Invalid ${k}`);
    return n;
  };
  const f = {
    q: get("q").slice(0, 100),
    region: get("region").slice(0, 80),
    district: get("district").slice(0, 80),
    city: get("city").slice(0, 80),
    industry: get("industry"),
    platform: get("platform"),
    language: get("language"),
    minFollowers: num("minFollowers"),
    maxFollowers: num("maxFollowers"),
    minRate: num("minRate"),
    maxRate: num("maxRate"),
    collab: get("collab"),
    sort: get("sort") || "recommended",
  };
  if (f.region && !Object.hasOwn(GEOGRAPHY, f.region))
    throw new Error("Invalid region");
  if (f.industry && !INDUSTRIES.includes(f.industry))
    throw new Error("Invalid industry");
  if (f.language && !LANGUAGES.includes(f.language))
    throw new Error("Invalid language");
  if (f.platform && !["instagram", "youtube", "facebook"].includes(f.platform))
    throw new Error("Invalid platform");
  if (f.collab && !["free", "paid"].includes(f.collab))
    throw new Error("Invalid collaboration option");
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
  for (const [a, b] of [
    ["minFollowers", "maxFollowers"],
    ["minRate", "maxRate"],
  ])
    if (f[a] !== null && f[b] !== null && f[a] > f[b])
      throw new Error("Invalid range");
  return f;
}
export const monthKey = (now = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(now));
export function redactCreator(c) {
  return {
    id: c.id,
    name: c.name,
    region: c.region,
    district: c.district,
    city: c.city,
    niche: c.niche,
    language: c.language,
    followers: c.followers,
    engagement: c.engagement,
    rate: c.rate,
    acceptsFreeCollab: c.acceptsFreeCollab,
    photo: c.photo,
    ...(c.photoIndex === undefined ? {} : { photoIndex: c.photoIndex }),
    ...(c.isDemo ? { isDemo: true } : {}),
    platforms:
      c.platforms ||
      [
        c.instagram ? "instagram" : null,
        c.youtube ? "youtube" : null,
        c.facebook ? "facebook" : null,
      ].filter(Boolean),
    locked: true,
  };
}
export function publicCreator(c, paid) {
  return paid
    ? {
        ...c,
        platforms:
          c.platforms ||
          [
            c.instagram ? "instagram" : null,
            c.youtube ? "youtube" : null,
            c.facebook ? "facebook" : null,
          ].filter(Boolean),
        locked: false,
      }
    : redactCreator(c);
}
const maleNames = [
  "Aarav",
  "Rohan",
  "Arjun",
  "Kabir",
  "Imran",
  "Dev",
  "Vikram",
  "Sai",
  "Adil",
  "Karthik",
  "Rohit",
  "Farhan",
  "Teja",
  "Vamshi",
  "Nikhil",
  "Rehan",
  "Varun",
  "Akash",
  "Zain",
  "Pranav",
];
const femaleNames = [
  "Aditi",
  "Meera",
  "Sana",
  "Kavya",
  "Ananya",
  "Priya",
  "Zoya",
  "Sneha",
  "Ayesha",
  "Neha",
  "Divya",
  "Ritika",
  "Nandini",
  "Suhana",
  "Isha",
  "Alia",
  "Tara",
  "Maya",
  "Anika",
  "Sara",
];
const surnames = [
  "Reddy",
  "Rao",
  "Khan",
  "Sharma",
  "Kumar",
  "Ali",
  "Nair",
  "Patel",
  "Verma",
  "Begum",
  "Das",
  "Iyer",
];
const sampleDistricts = Object.keys(GEOGRAPHY.Telangana);
export const SAMPLE_CREATORS = Array.from({ length: 100 }, (_, i) => {
  const female = (Math.floor(i / 10) + (i % 10)) % 2 === 1 || i === 99;
  const first = (female ? femaleNames : maleNames)[Math.floor(i / 2) % 20];
  const district = sampleDistricts[i % sampleDistricts.length];
  return {
    id: `sample-${String(i + 1).padStart(3, "0")}`,
    name: `${first} ${surnames[Math.floor(i / 40) * 4 + (i % 4)]}`,
    region: "Telangana",
    district,
    city: GEOGRAPHY.Telangana[district][0],
    niche: INDUSTRIES[i % 4],
    language: LANGUAGES[Math.floor(i / 3) % 4],
    followers: 3500 + i * 1847,
    engagement: Number((2.1 + (i % 37) / 10).toFixed(1)),
    rate: 1500 + (i % 12) * 850,
    acceptsFreeCollab: i % 3 === 0,
    bio: "Illustrative sample profile for exploring INFLUVIA. This is not a real influencer listing.",
    photo: "/sample-influencers-color.png",
    photoIndex: i,
    instagram: "",
    youtube: "",
    facebook: "",
    email: "",
    phone: "",
    platforms: [
      ["instagram"],
      ["youtube"],
      ["instagram", "facebook"],
      ["facebook"],
    ][i % 4],
    isDemo: true,
  };
});
export function sampleSearch(f, paid = true) {
  let rows = SAMPLE_CREATORS.filter(
    (c) =>
      (!f.q ||
        `${c.name} ${c.niche} ${c.city} ${c.district}`
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!f.region || c.region === f.region) &&
      (!f.district || c.district === f.district) &&
      (!f.city || c.city.toLowerCase().includes(f.city.toLowerCase())) &&
      (!f.industry || c.niche === f.industry) &&
      (!f.platform || c.platforms?.includes(f.platform) || c[f.platform]) &&
      (!f.language || c.language === f.language) &&
      (f.minFollowers === null || c.followers >= f.minFollowers) &&
      (f.maxFollowers === null || c.followers <= f.maxFollowers) &&
      (f.minRate === null || c.rate >= f.minRate) &&
      (f.maxRate === null || c.rate <= f.maxRate) &&
      (!f.collab ||
        (f.collab === "free" ? c.acceptsFreeCollab : !c.acceptsFreeCollab)),
  );
  rows.sort((a, b) =>
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
  return {
    total: rows.length,
    rows: (paid ? rows : rows.slice(0, 10)).map((c) => publicCreator(c, paid)),
  };
}

export function samplePage(filters, paid, cap, requestedPage = 1) {
  const all = sampleSearch(filters, true);
  const available = Math.min(all.total, cap === null ? all.total : cap);
  const pages = Math.max(1, Math.ceil(available / 12));
  const page = Math.max(1, Math.min(pages, Math.floor(requestedPage) || 1));
  return {
    sample: true,
    total: all.total,
    available,
    pages,
    page,
    rows: all.rows
      .slice((page - 1) * 12, Math.min(page * 12, available))
      .map((c) => publicCreator(c, paid)),
  };
}
