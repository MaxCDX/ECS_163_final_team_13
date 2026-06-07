import { EXPLORATION_MISSION_INSIGHTS, EXPLORATION_MISSIONS } from "../data/storyConfig.js";
import { missionEvidence } from "../utils/pokemonFilters.js";

// Missions turn open exploration into testable hypotheses after the guided story.
export function ExplorationMissions({ activeMission, onMissionSelect }) {
  return (
    <div className="exploration-missions" aria-label="Guided exploration missions">
      {EXPLORATION_MISSIONS.map((mission) => (
        <button
          key={mission.id}
          type="button"
          className={activeMission === mission.id ? "is-active" : ""}
          onClick={() => onMissionSelect(mission.id)}
        >
          <strong>{mission.title}</strong>
          <span>{mission.description}</span>
        </button>
      ))}
    </div>
  );
}

export function MissionInsightCard({ activeMission, pokemon }) {
  // Mission results reuse existing rankings and metrics; they do not introduce new data.
  const insight = activeMission ? EXPLORATION_MISSION_INSIGHTS.get(activeMission) : null;
  if (!insight) return null;
  const evidence = missionEvidence(insight, pokemon);

  return (
    <section className="mission-insight-card" aria-live="polite" aria-label="Mission takeaway">
      <div className="mission-insight-heading">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>{insight.title}</strong>
          <p>{insight.conclusion}</p>
        </div>
      </div>
      {evidence.length ? (
        <dl className="mission-evidence" aria-label="Mission evidence">
          {evidence.map((item) => {
            const [label, ...valueParts] = item.split(": ");
            return (
              <div key={item}>
                <dt>{label}</dt>
                <dd>{valueParts.join(": ")}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      <p className="mission-next-step">
        <strong>Next step:</strong> {insight.nextStep}
      </p>
    </section>
  );
}
