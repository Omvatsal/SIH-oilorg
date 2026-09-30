import type { Event, Source } from "../lib/types";

const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const hour = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" });

function minuteOfDay(date: Date) {
  const parts = hour.formatToParts(date);
  return Number(parts.find(part => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find(part => part.type === "minute")?.value ?? 0);
}

export function TimeWindows({ events, sources }: { events: Event[]; sources: Source[] }) {
  const timed = events.filter(event => event.time_interval && !Number.isNaN(Date.parse(event.time_interval.earliest)) && !Number.isNaN(Date.parse(event.time_interval.latest)));
  if (!timed.length) return null;
  const names = new Map(sources.map(source => [source.id, source.filename || "Field message"]));

  return <section className="page-section">
    <div className="section-heading"><h2>Reported work times</h2><span>IST</span></div>
    <p className="muted compact">Each bar shows a reported range, not an exact start time.</p>
    <div className="time-window-list">
      <div className="time-axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      {timed.map(event => {
        const interval = event.time_interval!;
        const start = new Date(interval.earliest), finish = new Date(interval.latest);
        const crossesDay = day.format(start) !== day.format(finish);
        const left = crossesDay ? 0 : minuteOfDay(start) / 1440 * 100;
        const width = crossesDay ? 100 : Math.max(1.5, Math.min(100 - left, (minuteOfDay(finish) - minuteOfDay(start)) / 1440 * 100));
        return <div className="time-window-row" key={event.id}>
          <div className="time-window-head"><strong>{event.object_tag || event.action.replaceAll("_", " ")}</strong><span>{interval.confidence.toLowerCase()} confidence</span></div>
          <div className="time-window-track" role="img" aria-label={`${hour.format(start)} to ${hour.format(finish)} IST, ${interval.confidence.toLowerCase()} confidence`}><span style={{ left: `${left}%`, width: `${width}%` }} /></div>
          <div className="time-window-detail"><span>{day.format(start)}{crossesDay ? ` to ${day.format(finish)}` : ""}</span><strong>{hour.format(start)}–{hour.format(finish)}</strong><span>{names.get(event.source_id) ?? "Field report"}</span></div>
          {interval.phrase && <small>Reported as “{interval.phrase}”</small>}
        </div>;
      })}
    </div>
  </section>;
}
