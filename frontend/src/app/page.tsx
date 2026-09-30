import Link from "next/link";
import { BRAND } from "../config/brand";

function FieldSketch() {
  return <svg className="field-sketch" viewBox="0 0 620 520" role="img" aria-labelledby="sketch-title sketch-description">
    <title id="sketch-title">A marked up construction plan beside field notes</title>
    <desc id="sketch-description">A site drawing with a pipe run, work sequence, and handwritten inspection marks.</desc>
    <rect x="28" y="26" width="560" height="468" rx="4" fill="#f5ecde" stroke="#d8c5aa" />
    <path d="M65 91h220v120H65zM285 91h237v120H285zM65 211h170v210H65zM235 211h287v210H235z" fill="#fffdf8" stroke="#d8c5aa" strokeWidth="2" />
    <path d="M92 150h160m0 0v-29m0 29v35m0-35h177m0 0v-33m0 33v36m0-36h63" fill="none" stroke="#b34a12" strokeWidth="10" strokeLinecap="square" />
    <path d="M92 150h160m0 0v-29m0 29v35m0-35h177m0 0v-33m0 33v36m0-36h63" fill="none" stroke="#f5ecde" strokeWidth="2" strokeDasharray="5 8" />
    <path d="M90 259h118M90 282h92M90 305h104" stroke="#d8c5aa" strokeWidth="5" strokeLinecap="round" />
    <path d="M263 263h217M263 287h169M263 311h203M263 355h217M263 379h151" stroke="#e4d9c8" strokeWidth="5" strokeLinecap="round" />
    <path d="m454 350 12 12 25-32" fill="none" stroke="#3d632e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M342 336c25-19 51-21 75-8" fill="none" stroke="#b34a12" strokeWidth="2" strokeDasharray="4 5" />
  </svg>;
}

export default function LandingPage() {
  return <main className="landing-page">
    <header className="landing-header">
      <Link className="landing-brand" href="/" aria-label={`${BRAND.name} home`}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{BRAND.name}<b>.</b></span></Link>
    </header>

    <section className="landing-hero">
      <div className="landing-copy">
        <h1>Keep the plan<br />close to the <em>site.</em></h1>
        <Link className="landing-cta" href="/workspace">Open workspace</Link>
      </div>
      <div className="landing-art"><FieldSketch /></div>
    </section>
  </main>;
}
