import { Link } from "react-router-dom";
import { createElement } from "react";
import {
  ArrowRight,
  ClipboardList,
  Compass,
  Hospital,
  Lock,
  MapPin,
  MessageSquare,
  Moon,
  Shield,
  Sun,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const features = [
  {
    icon: Shield,
    title: "Crime risk scoring",
    copy: "District-level risk built from open crime data, normalized 1-10 and updated daily.",
  },
  {
    icon: Compass,
    title: "Safer routing",
    copy: "Turn-by-turn directions annotated with risk per segment, so you can pick a calmer path.",
  },
  {
    icon: MessageSquare,
    title: "AI travel chat",
    copy: "Ask anything - from neighborhood vibes to emergency steps. Grounded in your live location.",
  },
  {
    icon: Hospital,
    title: "Hospitals nearby",
    copy: "Closest verified hospitals and trauma centers, ranked by distance, available offline.",
  },
  {
    icon: ClipboardList,
    title: "Trip checklists",
    copy: "Auto-generated, destination-aware checklists for documents, vaccines, and gear.",
  },
  {
    icon: Lock,
    title: "Privacy first",
    copy: "Your location is processed in real time and never sold. Encrypted at rest and in transit.",
  },
];

function LogoMark({ small = false }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-linear-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-[0_14px_34px_-26px_rgba(6,182,212,0.9)] ${
        small ? "h-9 w-9" : "h-12 w-12"
      }`}
    >
      <Compass className={small ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2.2} />
    </div>
  );
}

function DashboardPreview() {
  const stats = [
    ["RISK SCORE", "3.4", "Low"],
    ["HOSPITALS", "12", "within 5km"],
    ["ACTIVE ALERTS", "2", "today"],
  ];

  return (
    <div className="mx-auto mt-20 w-full max-w-6xl px-6 lg:px-8">
      <div className="voyageur-card overflow-hidden rounded-[28px]">
        <div className="flex items-center gap-5 border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <div className="flex gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-rose-400" />
            <span className="h-3.5 w-3.5 rounded-full bg-amber-300" />
            <span className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-300">
            app.voyageur.io / dashboard
          </span>
        </div>

        <div className="grid min-h-90 grid-cols-1 lg:grid-cols-[300px_1fr]">
          <aside className="border-b border-slate-200/80 p-6 dark:border-white/10 lg:border-b-0 lg:border-r">
            <div className="mb-4 rounded-2xl bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
              Dashboard
            </div>
            {["Trip Guide", "AI Chat", "Routes", "Settings"].map((item) => (
              <div key={item} className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                {item}
              </div>
            ))}
          </aside>

          <div className="space-y-5 p-6 lg:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              {stats.map(([label, value, caption]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-slate-900/35"
                >
                  <p className="mb-3 text-xs font-medium tracking-[0.12em] text-slate-500 dark:text-slate-300">
                    {label}
                  </p>
                  <p className="font-serif text-4xl leading-none text-slate-950 dark:text-white">
                    {value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{caption}</p>
                </div>
              ))}
            </div>

            <div className="relative min-h-52.5 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.14),transparent_34%),linear-gradient(135deg,rgba(236,254,255,0.86),rgba(255,255,255,0.75))] dark:border-white/10 dark:bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.5),rgba(15,23,42,0.72))]">
              <div className="absolute inset-0 voyageur-dot-grid opacity-50" />
              <div className="absolute left-[18%] top-[28%] h-px w-[70%] -rotate-12 bg-slate-300/80 dark:bg-white/10" />
              <div className="absolute bottom-[30%] left-0 h-px w-full rotate-6 bg-slate-300/80 dark:bg-white/10" />
              <div className="absolute left-[48%] top-[52%] flex h-14 w-14 items-center justify-center rounded-full bg-cyan-200/70 text-cyan-700 ring-8 ring-cyan-300/20 dark:bg-cyan-400/20 dark:text-cyan-200">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="absolute right-[16%] top-[52%] rounded-full border border-amber-300/70 bg-amber-100/60 px-4 py-2 text-xs font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300">
                Moderate - 6.2/10
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isDarkMode, toggleTheme } = useTheme();

  const scrollToFeatures = (e) => {
    e.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="voyageur-page-bg min-h-screen overflow-x-hidden text-slate-950 transition-colors duration-300 dark:text-slate-50">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/72 backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111f]/72">
        <div className="mx-auto flex h-24 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <LogoMark />
            <span className="font-serif text-3xl text-slate-950 dark:text-white">Voyageur</span>
          </Link>

          <div className="hidden items-center gap-10 lg:flex">
            <a href="#product" className="text-base font-medium text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
              Product
            </a>
            <a href="#features" onClick={scrollToFeatures} className="text-base font-medium text-slate-500 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
              Features
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-900 transition hover:bg-slate-100 dark:text-white dark:hover:bg-white/5"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/login" className="hidden text-base font-semibold text-slate-950 transition hover:text-cyan-700 dark:text-white dark:hover:text-cyan-300 sm:block">
              Sign in
            </Link>
            <Link
              to="/dashboard"
              className="voyageur-primary-btn inline-flex items-center gap-3 rounded-xl px-6 py-3 text-base font-semibold transition"
            >
              Open app <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 voyageur-dot-grid opacity-80" />
          <div className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-cyan-100/50 to-transparent dark:from-cyan-400/5" />
          <div className="relative mx-auto flex min-h-190 max-w-7xl flex-col items-center justify-center px-6 pb-20 pt-24 text-center lg:px-8">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/72 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/45 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
              Now with real-time route safety
            </div>

            <h1 className="max-w-5xl font-serif text-[clamp(4.25rem,8vw,7.5rem)] leading-[0.95] tracking-normal text-slate-950 dark:text-white">
              Travel anywhere.
              <br />
              <span className="italic text-cyan-600 dark:text-cyan-300">Know everywhere.</span>
            </h1>

            <p className="mt-9 max-w-3xl text-xl leading-9 text-slate-600 dark:text-slate-300">
              Voyageur turns crime data, hospital networks, and live conditions into one calm dashboard - so you spend less time worrying and more time exploring.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/dashboard"
                className="voyageur-primary-btn inline-flex min-w-72 items-center justify-center gap-3 rounded-xl px-8 py-4 text-base font-semibold transition"
              >
                Try the dashboard <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/signup"
                className="voyageur-secondary-btn inline-flex min-w-72 items-center justify-center rounded-xl px-8 py-4 text-base font-semibold transition hover:bg-white dark:hover:bg-white/5"
              >
                Create free account
              </Link>
            </div>

            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              No credit card - Free for travelers
            </p>
          </div>
        </section>

        <section id="product" className="relative border-y border-slate-200/80 py-20 dark:border-white/10">
          <div className="absolute inset-0 voyageur-dot-grid opacity-40" />
          <DashboardPreview />
        </section>

        <section id="features" className="relative px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-6 text-sm font-bold uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">
              Features
            </p>
            <h2 className="font-serif text-5xl leading-tight text-slate-950 dark:text-white md:text-6xl">
              Everything a thoughtful traveler needs.
            </h2>

            <div className="mt-16 grid gap-8 lg:grid-cols-3">
              {features.map(({ icon, title, copy }) => (
                <article
                  key={title}
                  className="voyageur-card group rounded-[22px] p-9 transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 transition group-hover:bg-cyan-100 dark:bg-cyan-400/10 dark:text-cyan-300 dark:group-hover:bg-cyan-400/15">
                    {createElement(icon, { className: "h-6 w-6", strokeWidth: 1.9 })}
                  </div>
                  <h3 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">{title}</h3>
                  <p className="text-lg leading-8 text-slate-600 dark:text-slate-300">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-slate-200/80 px-6 py-24 text-center dark:border-white/10 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-serif text-5xl text-slate-950 dark:text-white">Ready when you are.</h2>
            <p className="mt-7 text-xl text-slate-600 dark:text-slate-300">
              Open the dashboard and see your next trip through clearer eyes.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/dashboard"
                className="voyageur-primary-btn inline-flex items-center justify-center rounded-xl px-10 py-4 text-base font-semibold transition"
              >
                Open dashboard
              </Link>
              <Link
                to="/chat"
                className="voyageur-secondary-btn inline-flex items-center justify-center rounded-xl px-10 py-4 text-base font-semibold transition"
              >
                Talk to Voyageur
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/35 px-6 py-12 backdrop-blur-xl dark:border-white/10 dark:bg-[#020817]/35 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark small />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              (c) 2026 Voyageur. All rights reserved.
            </p>
          </div>
          <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-400">
            <a href="#privacy" className="transition hover:text-slate-950 dark:hover:text-white">Privacy</a>
            <a href="#terms" className="transition hover:text-slate-950 dark:hover:text-white">Terms</a>
            <a href="#contact" className="transition hover:text-slate-950 dark:hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
