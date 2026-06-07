import { STORY_STEPS } from "../data/storyConfig.js";

// Sticky navigation exposes the Martini Glass stages and keeps readers oriented while scrolling.
export default function StoryNav({ activeStep, onStep }) {
  return (
    <nav className="story-stepper" aria-label="Guided story stages">
      {STORY_STEPS.map((step, index) => (
        <button
          className={step.id === activeStep ? "is-active" : ""}
          key={step.id}
          type="button"
          onClick={() => onStep(step)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{step.label}</strong>
          <small>{step.title}</small>
        </button>
      ))}
    </nav>
  );
}
