import { CASE_STUDIES, LOCAL_IMAGE_PATHS } from "../data/storyConfig.js";
import { compactName, formatNumber, imageForPokemon, typeColor, typeLabel } from "../utils/pokemonFormatting.js";

function HeroRoster({ pokemon, imageLookup, onSelect }) {
  const featured = CASE_STUDIES.map((name) => pokemon.find((d) => d.Name === name)).filter(Boolean).slice(0, 6);

  return (
    <aside className="hero-roster" aria-label="Featured Pokémon in the network">
      <div className="hero-roster-header">
        <span>{featured.length}</span>
        <p>case-study Pokémon</p>
      </div>
      <div className="hero-sprite-grid">
        {featured.map((d) => (
          <button
            key={d.Name}
            style={{ "--type-color": typeColor(d.Type1) }}
            type="button"
            onClick={() => onSelect(d.Name, { scrollToNetwork: true })}
          >
            <span className="hero-sprite-frame">
              <img
                src={imageForPokemon(d.Name, imageLookup)}
                alt=""
                className={LOCAL_IMAGE_PATHS.has(d.Name) ? "is-loaded" : ""}
                onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
                onError={(event) => event.currentTarget.remove()}
              />
            </span>
            <span className="hero-card-name">{compactName(d.Name)}</span>
            <small>{typeLabel(d)}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function HeroSection({ pokemon, edges, builds, imageLookup, onSelect }) {
  return (
    <section id="assumption-section" className="hero" aria-labelledby="hero-title">
      <div>
        <p className="section-label">Team 13 · competitive Pokémon data story</p>
        <h1 id="hero-title">Raw power matters. Team fit matters too.</h1>
        <p className="data-kicker">VGC stats, usage, teammate networks, roles, moves, items, and abilities</p>
        <p>
          If raw stats alone explained competitive success, the strongest Pokémon should also be the most used. This
          story tests that assumption.
        </p>
        <div className="hero-facts" aria-label="Dataset summary">
          <span>{formatNumber(pokemon.length)} Pokémon</span>
          <span>{formatNumber(edges.length)} teammate links</span>
          <span>{formatNumber(builds.length)} build records</span>
        </div>
      </div>
      <HeroRoster pokemon={pokemon} imageLookup={imageLookup} onSelect={onSelect} />
    </section>
  );
}
