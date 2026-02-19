import { useState } from "react";
import Scenario1 from "./scenarios/Scenario1";
import Scenario2 from "./scenarios/Scenario2";
import Scenario3 from "./scenarios/Scenario3";

const scenarios = [
  { id: "scenario1", label: "Scenario1", component: Scenario1 },
  { id: "scenario2", label: "Scenario2", component: Scenario2 },
  { id: "scenario3", label: "Scenario3", component: Scenario3 },
];

export default function App() {
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const activeScenario = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  const ActiveComponent = activeScenario.component;

  return (
    <div className="container">
      <h1 className="h5 mb-3">Codatum Embed — React Example</h1>
      <ul className="nav nav-tabs mb-3">
        {scenarios.map((s) => (
          <li key={s.id} className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeId === s.id ? "active" : ""}`}
              onClick={() => setActiveId(s.id)}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <ActiveComponent />
    </div>
  );
}
