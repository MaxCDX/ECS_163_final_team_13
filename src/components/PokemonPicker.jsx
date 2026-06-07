import { useMemo } from "react";
import { PICKER_MODES } from "../data/storyConfig.js";
import { currentFocusTakeaway, missionRank, pickerMetric, rankedPickerOptions } from "../utils/pokemonFilters.js";
import { formatRank, typeLabel } from "../utils/pokemonFormatting.js";

export default function PokemonPicker({
  pokemon,
  imageLookup,
  selectedPokemon,
  selectedName,
  comparisonName,
  activeSlot,
  query,
  mode,
  onQueryChange,
  onModeChange,
  onSelect,
}) {
  // Lets readers move from guided narrative into their own usage/stats/synergy exploration.
  const modeInfo = PICKER_MODES.find((item) => item.id === mode) || PICKER_MODES[0];
  // Ranking modes show the same Pokemon through usage, raw stats, and teammate-footprint lenses.
  const options = useMemo(() => rankedPickerOptions(pokemon, query, mode), [mode, pokemon, query]);
  const currentFocus = useMemo(() => {
    if (!selectedPokemon) return null;
    const ranks = {
      usageRank: missionRank(pokemon, selectedPokemon.Name, "usage"),
      statsRank: missionRank(pokemon, selectedPokemon.Name, "stats"),
      synergyRank: missionRank(pokemon, selectedPokemon.Name, "synergy"),
    };
    return {
      ...ranks,
      takeaway: currentFocusTakeaway(ranks),
    };
  }, [pokemon, selectedPokemon]);

  return (
    <section className="pokemon-picker-section" aria-labelledby="pokemon-picker-title">
      <div className="picker-copy">
        <p className="section-label">Pick a focus</p>
        <h2 id="pokemon-picker-title">Choose a Pokémon to examine.</h2>
        <p>
          Search directly, or use the ranked shortcuts to test whether usage, raw stats, and team synergy point to the
          same names.
        </p>
      </div>

      <div className="pokemon-picker">
        <div className={`picker-current is-${activeSlot}`}>
          <div className="picker-current-identity">
            {selectedPokemon ? (
              <img src={imageLookup.get(selectedPokemon.Name) || ""} alt="" />
            ) : (
              <div className="picker-image-placeholder" />
            )}
            <div className="picker-current-name">
              <span>{activeSlot === "second" ? "Second selection" : "First selection"}</span>
              <strong>{selectedPokemon?.Name || "None selected"}</strong>
              <small>{selectedPokemon ? typeLabel(selectedPokemon) : "Choose a search result or ranked option"}</small>
            </div>
          </div>
          {currentFocus ? (
            <>
              <dl className="picker-current-ranks" aria-label={`${selectedPokemon.Name} ranking summary`}>
                <div>
                  <dt>Usage rank</dt>
                  <dd>{formatRank(currentFocus.usageRank)}</dd>
                </div>
                <div>
                  <dt>Stats rank</dt>
                  <dd>{formatRank(currentFocus.statsRank)}</dd>
                </div>
                <div>
                  <dt>Synergy rank</dt>
                  <dd>{formatRank(currentFocus.synergyRank)}</dd>
                </div>
              </dl>
              <p className="picker-current-takeaway">{currentFocus.takeaway}</p>
            </>
          ) : null}
        </div>

        <label className="picker-search">
          <span>Search by name</span>
          <input
            type="search"
            value={query}
            placeholder="Try Incineroar, Kyogre, Mewtwo..."
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <div className="picker-mode-row" aria-label="Rank suggestions by">
          {PICKER_MODES.map((item) => (
            <button
              className={item.id === mode ? "is-active" : ""}
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="picker-results" aria-label={query ? "Search results" : `${modeInfo.label} ranked suggestions`}>
          {options.length ? (
            options.map((item, index) => (
              <button
                className={[
                  item.Name === selectedName ? "is-first-selection" : "",
                  item.Name === comparisonName ? "is-second-selection" : "",
                  item.Name === (activeSlot === "second" ? comparisonName : selectedName) ? "is-active-selection" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={item.Name}
                type="button"
                onClick={() => onSelect(item.Name)}
              >
                <span className="picker-rank">{query ? "Result" : `#${index + 1}`}</span>
                <img src={imageLookup.get(item.Name) || ""} alt="" />
                <span className="picker-name">
                  <strong>{item.Name}</strong>
                  <small>{typeLabel(item)}</small>
                </span>
                <span className="picker-metric">
                  <strong>{pickerMetric(item, mode)}</strong>
                  <small>{modeInfo.metricLabel}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="picker-empty">No Pokémon match that search.</p>
          )}
        </div>
      </div>
    </section>
  );
}
