"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  Check,
  MapPin,
  SlidersHorizontal,
  FileSpreadsheet,
  LockKeyhole,
  Menu,
  X,
  Search,
  Plus,
  Minus,
  Pause,
  Play,
  Globe,
  Users,
  Target,
  Layers,
} from "lucide-react";
import {
  Logo,
  Portrait,
  api,
  money,
  type Creator,
  type Account,
} from "./shared";
import { RegistrationForm } from "./register-form";
import { HeroAtmosphere, useLandingMotion } from "./hero-motion";
import { SAMPLE_CREATORS, PACKAGE_DRAFTS } from "../lib/catalog.mjs";
const Gallery = dynamic(() => import("./creator-gallery"), {
  ssr: false,
  loading: () => (
    <div className="gallery-loading">Loading the creator showcase…</div>
  ),
});
const samples = SAMPLE_CREATORS as Creator[];

export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("revealed");
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`mono-reveal ${className}`} ref={ref}>
      {children}
    </div>
  );
}
function Action({
  href,
  children,
  light = false,
}: {
  href: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <a href={href} className={`mono-action ${light ? "action-light" : ""}`}>
      {children}
      <span>
        <ArrowUpRight size={19} />
      </span>
    </a>
  );
}

export function Landing() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [plans, setPlans] = useState<any[]>(PACKAGE_DRAFTS);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  useLandingMotion(pageRef, paused);
  useEffect(() => {
    api("me")
      .then((d) => setAccount(d.account))
      .catch(() => {});
    api("packages")
      .then((d) => setPlans(d.packages))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [menu]);
  const discover = account ? "/brand" : "#register";
  return (
    <div ref={pageRef} className={`mono-site ${paused ? "motion-paused" : ""}`}>
      <div className="mono-scroll-progress" aria-hidden="true" />
      <header className="mono-header">
        <Logo />
        <nav aria-label="Main navigation" className={menu ? "is-open" : ""}>
          <a href="#about" onClick={() => setMenu(false)}>
            About INFLUVIA
          </a>
          <a href="#why-creators" onClick={() => setMenu(false)}>
            Why creators
          </a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#membership" onClick={() => setMenu(false)}>
            Membership
          </a>
          {account ? <a href="/brand">Discover</a> : null}
          {account?.owner ? <a href="/owner">Admin</a> : null}
        </nav>
        <div className="mono-nav-actions">
          <a href={account ? "/account" : "/login"}>
            {account ? "My account" : "Log in"}
          </a>
          <Action href={discover}>
            {account ? "Open discovery" : "Get started free"}
          </Action>
          <button
            aria-label="Toggle menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
            className="mono-menu"
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      <main>
        <section className="mono-hero" aria-labelledby="hero-heading">
          <HeroAtmosphere />
          <div className="mono-hero-intro">
            <div>
              <span className="mono-eyebrow">
                <i /> THE CREATOR DISCOVERY PLATFORM
              </span>
              <h1 id="hero-heading">
                Find your people.
                <br />
                <span>Grow your brand.</span>
              </h1>
              <div className="hero-feature-pills">
                <span>
                  <MapPin size={13} /> Local voices
                </span>
                <span>
                  <SlidersHorizontal size={13} /> Smarter filters
                </span>
                <span>
                  <FileSpreadsheet size={13} /> Excel exports
                </span>
              </div>
            </div>
            <div className="mono-hero-story">
              <span className="mono-section-number">
                A BETTER WAY TO DISCOVER
              </span>
              <p>
                Somewhere in your city, there’s a creator who gets your
                business. We help you find them.
              </p>
              <p>
                Search by location, language, industry, audience, and budget.
                Build a shortlist that makes sense for your brand.
              </p>
              <div>
                <Action href={discover}>
                  {account ? "Discover creators" : "Find your creator"}
                </Action>
                <a
                  className="mono-down-link"
                  href="#about"
                  aria-label="Learn about INFLUVIA"
                >
                  <ArrowDown size={21} />
                </a>
              </div>
              <small>
                Free registration. Start with 10 results per search.
              </small>
              <div className="hero-search-example">
                <Search size={16} aria-hidden="true" />
                <div>
                  <span>YOUR NEXT SEARCH COULD BE</span>
                  <div
                    className="hero-search-window"
                    aria-label="Try food creators in Nizamabad, fashion creators in Hyderabad, or property creators in Sangareddy"
                  >
                    <div aria-hidden="true">
                      <b>Food creators in Nizamabad</b>
                      <b>Fashion creators in Hyderabad</b>
                      <b>Property creators in Sangareddy</b>
                      <b>Food creators in Nizamabad</b>
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={15} aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="mono-hero-gallery">
            <div className="mono-gallery-topline">
              <span>
                <i /> THE CREATOR SHOWCASE
              </span>
              <span>100 SAMPLE PORTRAITS / EXPLORE IN 3D</span>
            </div>
            <Gallery
              creators={samples}
              autoPlay={!paused}
              openLabel={account ? "Open discovery" : "Register to discover"}
              onOpen={() =>
                window.location.assign(account ? "/brand" : "/join")
              }
            />
            <div className="mono-gallery-bottomline">
              <span>
                Illustrative profiles. Your real directory begins with your own
                data.
              </span>
              <button onClick={() => setPaused(!paused)}>
                {paused ? <Play size={11} /> : <Pause size={11} />}
                {paused ? "Resume motion" : "Pause motion"}
              </button>
            </div>
          </div>
        </section>
        <div
          className="mono-ticker"
          aria-label="Food, real estate, clothing, lifestyle"
        >
          <div aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i}>
                FOOD & CULTURE <b>✳</b> REAL ESTATE <b>✳</b> FASHION & STYLE{" "}
                <b>✳</b> EVERYDAY INFLUENCE <b>✳</b>
              </span>
            ))}
          </div>
        </div>

        <section className="mono-about mono-section" id="about">
          <Reveal className="mono-about-title">
            <span className="mono-section-number">BUILT FOR YOUR BUSINESS</span>
            <h2>
              Good businesses
              <br />
              deserve to
              <br />
              <em>be discovered.</em>
            </h2>
            <span className="mono-about-index">INFLUVIA / INDIA</span>
          </Reveal>
          <Reveal className="mono-about-copy">
            <span className="mono-label">WHAT WE DO</span>
            <p className="mono-lead">
              {"We bring local businesses and local influence into the same picture."
                .split(" ")
                .map((word, i) => (
                  <span className="scroll-word" key={i}>
                    {word}{" "}
                  </span>
                ))}
            </p>
            <p>
              A restaurant opening its doors. A clothing label finding its
              audience. A property business introducing a new neighbourhood. The
              right creator can help people see your story through a voice they
              recognise.
            </p>
            <p>
              INFLUVIA is a searchable directory that helps you discover those
              voices, compare the details that matter, and take a filtered
              shortlist into your own workflow.
            </p>
            <div className="mono-about-facts">
              <div>
                <b>Discover</b>
                <span>People who fit your brand.</span>
              </div>
              <div>
                <b>Decide</b>
                <span>Location, audience, and budget.</span>
              </div>
              <div>
                <b>Download</b>
                <span>Your shortlist in Excel.</span>
              </div>
            </div>
            <a className="mono-text-link" href="#how-it-works">
              A simpler way to find your people <ArrowUpRight size={18} />
            </a>
          </Reveal>
        </section>

        <section className="mono-influence" id="why-creators">
          <div className="mono-influence-sticky">
            <span className="mono-section-number">WHY CREATORS MATTER</span>
            <h2>
              People listen
              <br />
              to <span>people.</span>
            </h2>
            <p>
              An influencer is more than a follower count. They bring a point of
              view, a community, and a way of telling a story that feels human.
            </p>
            <a href="#register" className="mono-text-link">
              Find a voice for your business <ArrowUpRight size={18} />
            </a>
            <span className="mono-sticky-note">
              THE RIGHT FIT STARTS WITH RELEVANCE.
            </span>
          </div>
          <div className="mono-influence-stories">
            {[
              {
                n: "01",
                title: "Be part of the conversation.",
                copy: "Creators make ideas part of everyday content. A local food story or a real walk through a property can give people context that a standalone advertisement cannot.",
                person: samples[1],
                tag: "A HUMAN WAY TO BE SEEN",
              },
              {
                n: "02",
                title: "Start with shared context.",
                copy: "Language, neighbourhood, and interests matter. A creator who understands your community can help introduce your business in a way that feels relevant to the people you want to reach.",
                person: samples[7],
                tag: "LOCAL KNOWLEDGE. LOCAL RELEVANCE.",
              },
              {
                n: "03",
                title: "Choose a meaningful fit.",
                copy: "The largest audience is not always the best match. Explore industry, audience size, indicative rates, and free collaboration preferences to find a practical starting point.",
                person: samples[16],
                tag: "BEYOND THE FOLLOWER COUNT",
              },
            ].map((s) => (
              <Reveal className="mono-story" key={s.n}>
                <div className="mono-story-photo">
                  <svg
                    className="editorial-photo"
                    viewBox={`${Number(s.n) - 1} 0 1 2`}
                    preserveAspectRatio="xMidYMid slice"
                    role="img"
                    aria-label="Illustrative local creator"
                  >
                    <image
                      href="/creator-editorial-v3.png"
                      x="0"
                      y="0"
                      width="3"
                      height="2"
                    />
                  </svg>
                  <span>{s.tag}</span>
                  <b>{s.n}</b>
                </div>
                <div className="mono-story-copy">
                  <h3>{s.title}</h3>
                  <p>{s.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section
          className="mono-capabilities mono-section"
          id="what-you-can-do"
        >
          <Reveal className="mono-section-heading">
            <div>
              <span className="mono-section-number">
                DISCOVERY, MADE USEFUL
              </span>
              <h2>
                A little less searching.
                <br />
                <em>A lot more possibility.</em>
              </h2>
            </div>
            <p>
              Turn a broad brief into a focused shortlist. Keep your search
              specific to the business you’re building.
            </p>
          </Reveal>
          <div className="mono-capability-grid">
            <Reveal className="mono-capability-main">
              <div className="mono-mini-app">
                <div className="mono-mini-app-head">
                  <Logo />
                  <SlidersHorizontal size={18} />
                </div>
                <div className="mono-mini-search">
                  <Search size={18} />
                  <span>Food creators in Nizamabad</span>
                  <ArrowUpRight size={17} />
                </div>
                <div className="mono-mini-tags">
                  <span>Telangana</span>
                  <span>Telugu</span>
                  <span>Free collabs</span>
                </div>
                {[samples[1], samples[12], samples[23]].map((c) => (
                  <div className="mono-mini-person" key={c.id}>
                    <Portrait creator={c} />
                    <div>
                      <b>{c.name}</b>
                      <small>
                        {c.niche} · {c.language}
                      </small>
                    </div>
                    <LockKeyhole size={15} />
                  </div>
                ))}
                <div className="mono-mini-export">
                  <FileSpreadsheet size={18} />
                  Your next shortlist.xlsx <Check size={15} />
                </div>
              </div>
              <span>YOUR BRIEF, BROUGHT INTO FOCUS</span>
            </Reveal>
            <div className="mono-capability-list">
              {[
                {
                  icon: <MapPin />,
                  title: "Start where your business is.",
                  text: "Search a whole region, then narrow down to a district or city.",
                },
                {
                  icon: <Target />,
                  title: "Find your kind of creator.",
                  text: "Food, real estate, clothing, and general creators, filtered by followers and indicative price.",
                },
                {
                  icon: <Globe />,
                  title: "Speak the same language.",
                  text: "Discover creators working in Telugu, Urdu, Hindi, or English.",
                },
                {
                  icon: <Layers />,
                  title: "Make the collaboration practical.",
                  text: "Look for creators open to free dinners, products, or experiences, alongside paid options.",
                },
              ].map((c, i) => (
                <Reveal className="mono-capability" key={c.title}>
                  <span>{c.icon}</span>
                  <div>
                    <small>0{i + 1}</small>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mono-process mono-section" id="how-it-works">
          <Reveal className="mono-section-heading">
            <div>
              <span className="mono-section-number">
                THREE STEPS. ONE SHORTLIST.
              </span>
              <h2>
                From a business idea
                <br />
                to <em>a useful shortlist.</em>
              </h2>
            </div>
            <Action href={discover}>
              {account ? "Open discovery" : "Create your account"}
            </Action>
          </Reveal>
          <div className="mono-process-grid">
            {[
              {
                n: "01",
                title: "Register for free.",
                text: "Create your account and enter the discovery portal. Free users can preview 10 results per search, with contact details protected.",
              },
              {
                n: "02",
                title: "Search with intent.",
                text: "Set your location, language, industry, followers, budget, and collaboration filters. Explore creators as a 3D gallery, cards, or a list.",
              },
              {
                n: "03",
                title: "Unlock. Export. Take it forward.",
                text: "Activate a package to reveal business details and social profiles. Download your filtered results as a real Excel file.",
              },
            ].map((s) => (
              <Reveal className="mono-process-step" key={s.n}>
                <span>
                  {s.n}
                  <ArrowRight size={20} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </div>
          <p className="mono-outreach-note">
            <LockKeyhole size={14} />
            INFLUVIA is a discovery and export platform. All outreach happens
            independently outside the portal.
          </p>
        </section>

        <section className="mono-people-wall">
          <Reveal>
            <span className="mono-section-number">
              A WHOLE WORLD OF LOCAL VOICES
            </span>
            <h2>
              Your next possibility
              <br />
              <span>has a face.</span>
            </h2>
          </Reveal>
          <div
            className="mono-wall-columns"
            aria-label="100 illustrative influencer portraits"
          >
            {Array.from({ length: 10 }, (_, col) => (
              <div key={col}>
                {samples
                  .filter((_, i) => i % 10 === col)
                  .map((c) => (
                    <div key={c.id}>
                      <Portrait creator={c} />
                      <span>{c.name}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <span className="mono-wall-disclaimer">
            100 generated sample portraits. Fictional people, shown for
            illustration.
          </span>
        </section>

        <section className="mono-membership mono-section" id="membership">
          <Reveal className="mono-section-heading">
            <div>
              <span className="mono-section-number">
                A PLAN FOR YOUR NEXT CHAPTER
              </span>
              <h2>
                Start curious.
                <br />
                <em>Grow from there.</em>
              </h2>
            </div>
            <p>
              Registration is always free. Packages give you more searches, more
              results, and the details you need to take the next step.
            </p>
          </Reveal>
          <div className="mono-plan-grid">
            <Reveal className="mono-plan">
              <span>THE FIRST LOOK</span>
              <h3>Free</h3>
              <div className="mono-plan-price">
                ₹0<small>Always</small>
              </div>
              <p>A place to start discovering.</p>
              <ul>
                <li>
                  <Check />
                  Free account and email login
                </li>
                <li>
                  <Check />
                  10 results per search
                </li>
                <li>
                  <Check />
                  Discovery filters
                </li>
                <li>
                  <LockKeyhole />
                  Protected contacts and social links
                </li>
              </ul>
              <Action href={discover}>Start for free</Action>
            </Reveal>
            {plans.map((p, i) => (
              <Reveal
                className={`mono-plan ${i === 0 ? "mono-plan-dark" : ""}`}
                key={p.id}
              >
                <span>
                  {i === 0 ? "FOCUSED DISCOVERY" : "THE BIGGER PICTURE"}
                </span>
                <h3>{p.name}</h3>
                <div className="mono-plan-price">
                  {p.configured ? money(p.price) : "Coming soon"}
                  <small>
                    {p.configured
                      ? "per month"
                      : "Pricing set by the administrator"}
                  </small>
                </div>
                <p>{p.description}</p>
                <ul>
                  <li>
                    <Check />
                    {p.searchLimit === null
                      ? "Unlimited monthly searches"
                      : `${p.searchLimit} searches per month`}
                  </li>
                  <li>
                    <Check />
                    {p.resultLimit === null
                      ? "Full matching results"
                      : `${p.resultLimit} results per search`}
                  </li>
                  <li>
                    <Check />
                    Business details and social profiles
                  </li>
                  <li>
                    <Check />
                    Filtered Excel downloads
                  </li>
                </ul>
                <Action
                  href={account ? "/billing" : "#register"}
                  light={i === 0}
                >
                  Explore {p.name}
                </Action>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mono-register mono-section" id="register">
          <Reveal className="mono-register-story">
            <span className="mono-section-number">MAKE YOUR NEXT MOVE</span>
            <h2>
              Good business.
              <br />
              Good people.
              <br />
              <em>Start here.</em>
            </h2>
            <p>
              Create a free account and step into discovery. Your first 10
              results per search are ready when you are.
            </p>
            <div>
              <Users size={18} />
              <span>
                Built for local businesses,
                <br />
                brands, and people with a plan.
              </span>
            </div>
            <div className="mono-register-portraits">
              {[samples[7], samples[8], samples[15]].map((c) => (
                <Portrait creator={c} key={c.id} />
              ))}
            </div>
          </Reveal>
          <Reveal className="mono-register-card">
            <span className="mono-label">LET’S MAKE IT OFFICIAL</span>
            <h3>Create your free account.</h3>
            <p>No payment needed to start searching.</p>
            <RegistrationForm />
          </Reveal>
        </section>

        <section className="mono-faq mono-section">
          <Reveal className="mono-section-heading">
            <div>
              <span className="mono-section-number">
                A FEW THINGS, ANSWERED.
              </span>
              <h2>
                Before you
                <br />
                <em>make your first move.</em>
              </h2>
            </div>
          </Reveal>
          <div>
            {[
              [
                "Can I use INFLUVIA for free?",
                "Yes. Registration and login are free. You can search with filters and see up to 10 results per search. Social links, handles, email, phone, and Excel downloads unlock with an active paid package.",
              ],
              [
                "Can I message influencers through the website?",
                "There is no messaging or campaign management inside INFLUVIA. Paid members use the revealed business details or exported Excel file to manage outreach independently.",
              ],
              [
                "What does the Excel download include?",
                "Your export follows the filters and result limits of your search and membership. Paid downloads include available creator details, platform URLs, rates, location, and collaboration preferences.",
              ],
              [
                "Are the portraits shown here real influencers?",
                "The 100 monochrome portraits are generated placeholders for the preview. When the administrator adds or bulk imports influencer records, the discovery portal displays those records and their supplied photo URLs. Records without an image use a labelled placeholder.",
              ],
            ].map(([q, a], i) => (
              <div
                className={`mono-faq-item ${faq === i ? "is-open" : ""}`}
                key={q}
              >
                <button
                  aria-expanded={faq === i}
                  aria-controls={`faq-answer-${i}`}
                  onClick={() => setFaq(faq === i ? null : i)}
                >
                  {q}
                  {faq === i ? <Minus size={18} /> : <Plus size={18} />}
                </button>
                <div id={`faq-answer-${i}`} hidden={faq !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="mono-footer">
        <div className="mono-footer-top">
          <Logo />
          <span>
            LOCAL VOICES.
            <br />
            REAL POSSIBILITIES.
          </span>
          <a href={discover}>
            Let’s find your creator.
            <ArrowUpRight size={45} />
          </a>
        </div>
        <div className="mono-footer-bottom">
          <span>© {new Date().getFullYear()} INFLUVIA</span>
          <nav aria-label="Footer navigation">
            <a href="#about">About</a>
            <a href="#membership">Membership</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/join">Register</a>
            <a href="/login">Log in</a>
          </nav>
          <span>MADE FOR LOCAL. BUILT FOR WHAT’S NEXT.</span>
        </div>
      </footer>
    </div>
  );
}
