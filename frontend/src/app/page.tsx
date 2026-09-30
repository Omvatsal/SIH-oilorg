import Link from "next/link";
import { BRAND } from "../config/brand";

function SiteBuildings() {
  return <svg className="site-buildings" viewBox="0 0 640 520" role="img" aria-labelledby="site-title site-description">
    <title id="site-title">Industrial construction site</title>
    <desc id="site-description">A line illustration of process buildings, pipe racks, and a tower crane.</desc>
    <path d="M20 442h600" stroke="#6e5a48" strokeWidth="3" />
    <path d="M58 304 137 252h203v190H58z" fill="#e9dbc5" stroke="#2b1d14" strokeWidth="3" />
    <path d="M58 304h282M137 252v52m68-52v52m67-52v52M88 337h47v68H88zm87 0h46v68h-46zm86 0h46v68h-46z" fill="none" stroke="#6e5a48" strokeWidth="3" />
    <path d="M340 442V207h116v235M326 207h144M351 180h94v27m-76-27v-29h59v29m-78 56h24m18 0h24m18 0h24m-108 36h24m18 0h24m18 0h24m-108 36h24m18 0h24m18 0h24" fill="#fffdf8" stroke="#2b1d14" strokeWidth="3" />
    <path d="M369 151h59m-48-14h37m-31-14h26M369 151V98m59 53V98m-59 0 29-28 30 28m-62 0h64" fill="none" stroke="#b34a12" strokeWidth="4" strokeLinejoin="round" />
    <path d="M474 442V287h106v155m-106-155 53-40 53 40m-89 38h72m-72 37h72m-72 37h72m-54-112v151m37-151v151" fill="#f5ecde" stroke="#6e5a48" strokeWidth="3" />
    <path d="M41 277h279m-279 17h279m-245-17v59m66-59v59m66-59v59m66-59v59" fill="none" stroke="#b34a12" strokeWidth="5" />
    <path d="M28 432h592M55 457h515M85 477h460" stroke="#d8c5aa" strokeWidth="2" />
    <path d="M505 248h40v-24m-20 24v23m-40-29h80" fill="none" stroke="#3d632e" strokeWidth="4" />
    <path d="M499 316h58m-58 37h58m-58 37h58" stroke="#d8c5aa" strokeWidth="3" />
  </svg>;
}

type FeatureIconName = "plan" | "field" | "review" | "progress";

function FeatureIcon({ name }: { name: FeatureIconName }) {
  const icons: Record<FeatureIconName, React.ReactNode> = {
    plan: <><path d="M12 3.5 20 7v10l-8 3.5L4 17V7z" /><path d="m4 7 8 3.5L20 7M12 10.5v10M8 5.3l8 3.5" /></>,
    field: <><path d="M4 14.5h16l-1.6-5.1a2 2 0 0 0-1.9-1.4h-7A2 2 0 0 0 7.6 9z" /><path d="M4 14.5v2h16v-2M12 8V5m-3 3.2V6.5m6 1.7V6.5M7 18.5v1m10-1v1" /></>,
    review: <><path d="M7 4.5h10v2h3v14H4v-14h3z" /><path d="M9 4.5v-2h6v2M8 12l2.2 2.2L16 9M8 17h8" /></>,
    progress: <><path d="M4 19.5h16M6 16V9m6 7V5m6 11v-4" /><path d="m4 7 4-3 4 2 6-4" /></>,
  };
  return <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

export default function LandingPage() {
  return <main className="landing-page">
    <header className="landing-header">
      <Link className="landing-brand" href="/" aria-label={`${BRAND.name} home`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{BRAND.name}<b>.</b></span></Link>
      <nav className="landing-nav" aria-label="Page sections">
        <a href="#how-it-works">How it works</a>
        <a href="#faq">FAQs</a>
      </nav>
    </header>

    <section className="landing-hero">
      <div className="landing-copy">
        <h1>Keep the plan<br />close to the <em>site.</em></h1>
        <Link className="landing-cta" href="/workspace">Open workspace</Link>
        <p className="landing-deck">Bring the schedule, field updates, and the decisions behind each change into one clear view.</p>
      </div>
      <div className="landing-art"><SiteBuildings /></div>
    </section>

    <section className="landing-features" aria-labelledby="features-title">
      <h2 id="features-title">Made for the work<br />happening out there.</h2>
      <div className="feature-list">
        <article className="feature-row"><div className="feature-art"><FeatureIcon name="plan" /></div><div><h3>Start with the actual plan.</h3><p>Bring in a CSV or Primavera XER, review the activities, and catch broken task links before they create surprises on site.</p></div></article>
        <article className="feature-row"><div className="feature-art"><FeatureIcon name="field" /></div><div><h3>Hear what happened in the field.</h3><p>Collect typed or spoken supervisor notes alongside daily reports, then keep each source attached to the work it describes.</p></div></article>
        <article className="feature-row"><div className="feature-art"><FeatureIcon name="review" /></div><div><h3>Keep people in the decision.</h3><p>Surface conflicting updates and missing evidence. Review proposed schedule changes before they are applied.</p></div></article>
        <article className="feature-row"><div className="feature-art"><FeatureIcon name="progress" /></div><div><h3>See the day as it unfolds.</h3><p>Follow reported completion, quantities, time windows, and open site issues together in one workspace.</p></div></article>
      </div>
    </section>

    <section className="landing-how" id="how-it-works" aria-labelledby="how-title">
      <div className="landing-section-intro">
        <h2 id="how-title">From the schedule<br />to the <em>site record.</em></h2>
        <p>Three steps bring the planned work and daily updates into the same conversation.</p>
      </div>
      <ol className="landing-steps">
        <li><span className="step-number">01</span><div><h3>Import the plan</h3><p>Upload a CSV or XER schedule. Check the activity table and task dependencies before comparing it with field work.</p></div></li>
        <li><span className="step-number">02</span><div><h3>Record actual work</h3><p>Type a note, use voice transcription, or attach a daily report. Review what was captured, then submit it.</p></div></li>
        <li><span className="step-number">03</span><div><h3>Review the outcome</h3><p>See progress and conflicts together. Approve or reject proposed changes with the field evidence in view.</p></div></li>
      </ol>
    </section>

    <section className="landing-faq" id="faq" aria-labelledby="faq-title">
      <div className="landing-section-intro">
        <h2 id="faq-title">Good to know<br />before you start.</h2>
        <p>Short answers about what this prototype can do today.</p>
      </div>
      <div className="faq-list">
        <details><summary>Which files can I upload?</summary><p>Planned schedules accept CSV and Primavera XER files. For actual work, you can add a note or upload TXT, CSV, or XLSX reports.</p></details>
        <details><summary>Can I speak a field update?</summary><p>Yes. In a browser with speech recognition support, record a note, review the transcription, and submit it with your other actual work.</p></details>
        <details><summary>Where does my uploaded data go?</summary><p>This prototype keeps workspace data in the API process memory. Restarting the API clears that data, so do not use it as a permanent project archive.</p></details>
        <details><summary>Are schedule changes applied automatically?</summary><p>Proposed changes appear for review in the workspace. A planner can approve or reject them; blocked changes cannot be applied.</p></details>
      </div>
    </section>
  </main>;
}
