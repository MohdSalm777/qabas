import { useEffect, useState } from "react";
import { getCatalogue } from "../services/api";

// Investigations: every NASA combustion investigation named in the challenge
// statement, ranked by how relevant it is to a chosen fire safety need.

const PILLARS = ["Prevention", "Detection", "Suppression", "Supporting science"];
const LEVELS = { direct: 2, related: 1 };

function InvestigationCard({ inv, rank, match, onExplore }) {
  const full = inv.qabas_data === "full";
  return (
    <article className={full ? "inv inv-full" : "inv"}>
      <div className="inv-head">
        {rank && <span className="rank-number">{rank}</span>}
        <div>
          <h4 className="inv-name">{inv.name}</h4>
          <p className="hint">{inv.full_name}</p>
        </div>
      </div>

      {match && (
        <p className="inv-match">
          <span className={match.level === "direct" ? "badge badge-direct" : "badge"}>
            {match.level === "direct" ? "Directly relevant" : "Related"}
          </span>{" "}
          {match.reason}
        </p>
      )}

      <p className="inv-summary">{inv.summary}</p>

      <dl className="card-facts">
        <div>
          <dt>Pillar</dt>
          <dd>{inv.pillar}</dd>
        </div>
        <div>
          <dt>Fuel</dt>
          <dd>{inv.fuel || "Not stated"}</dd>
        </div>
        <div>
          <dt>Hardware</dt>
          <dd>{inv.hardware || "Not stated"}</dd>
        </div>
      </dl>

      {full ? (
        <button className="primary inv-action" onClick={onExplore}>
          Full data in QABAS · explore
        </button>
      ) : (
        <p className="inv-status">Summary only · detailed data coming next</p>
      )}
    </article>
  );
}

function Investigations({ onExplore }) {
  const [catalogue, setCatalogue] = useState(null);
  const [failed, setFailed] = useState(false);
  const [need, setNeed] = useState("all");

  useEffect(() => {
    getCatalogue()
      .then(setCatalogue)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="message">Could not load the investigations.</p>;
  if (!catalogue) return <p className="message">Loading investigations…</p>;

  const all = catalogue.investigations;
  const fullCount = all.filter((i) => i.qabas_data === "full").length;
  const activeNeed = catalogue.needs.find((n) => n.id === need);

  const ranked = all
    .filter((i) => i.relevance[need])
    .sort(
      (a, b) =>
        LEVELS[b.relevance[need].level] - LEVELS[a.relevance[need].level] ||
        (b.qabas_data === "full") - (a.qabas_data === "full")
    );

  return (
    <>
      <p className="lab-label">What do you need to know?</p>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={need === "all"}
          className={need === "all" ? "tab tab-active" : "tab"}
          onClick={() => setNeed("all")}
        >
          All investigations
        </button>
        {catalogue.needs.map((n) => (
          <button
            key={n.id}
            role="tab"
            aria-selected={need === n.id}
            className={need === n.id ? "tab tab-active" : "tab"}
            onClick={() => setNeed(n.id)}
          >
            {n.label}
          </button>
        ))}
      </div>

      {need === "all" ? (
        <>
          <p className="count">
            {all.length} investigations · {fullCount} with full data in QABAS ·{" "}
            {all.length - fullCount} summary only
          </p>
          {PILLARS.map((pillar) => {
            const group = all.filter((i) => i.pillar === pillar);
            if (group.length === 0) return null;
            return (
              <div key={pillar}>
                <h3 className="sub">
                  {pillar} <span className="sub-count">{group.length}</span>
                </h3>
                <div className="grid">
                  {group.map((inv) => (
                    <InvestigationCard key={inv.id} inv={inv} onExplore={onExplore} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <>
          <div className="callout">
            <p>
              <strong>NASA says:</strong> {activeNeed.context}
            </p>
          </div>
          <p className="count">
            {ranked.length} of {all.length} investigations ranked for this need, most relevant
            first
          </p>
          <div className="grid">
            {ranked.map((inv, index) => (
              <InvestigationCard
                key={inv.id}
                inv={inv}
                rank={index + 1}
                match={inv.relevance[need]}
                onExplore={onExplore}
              />
            ))}
          </div>
        </>
      )}

      <p className="hint inv-source">
        Summaries and relevance come from the{" "}
        <a href={catalogue.source.url} target="_blank" rel="noreferrer">
          NASA challenge statement
        </a>
        . Order: directly relevant first, then related, with investigations QABAS has full data
        for ahead of the rest. &quot;Not stated&quot; means the statement does not say.
      </p>
    </>
  );
}

export default Investigations;