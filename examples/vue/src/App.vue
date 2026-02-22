<script setup lang="ts">
import { ref, computed, type Component } from "vue";
import Scenario1 from "./scenarios/Scenario1.vue";
import Scenario2 from "./scenarios/Scenario2.vue";
import Scenario3 from "./scenarios/Scenario3.vue";
import Mock from "./scenarios/Mock.vue";

type ScenarioItem = { id: string; label: string; component: Component };
const scenarios: ScenarioItem[] = [
  { id: "scenario1", label: "Scenario1", component: Scenario1 },
  { id: "scenario2", label: "Scenario2", component: Scenario2 },
  { id: "scenario3", label: "Scenario3", component: Scenario3 },
  { id: "mock", label: "Mock", component: Mock },
];

const activeId = ref(scenarios[0].id);
const activeScenario = computed(
  () => scenarios.find((s) => s.id === activeId.value) ?? scenarios[0]
);
</script>

<template>
  <div class="container">
    <h1 class="h5 mb-3">Codatum Embed — Vue Example</h1>
    <ul class="nav nav-tabs mb-3">
      <li class="nav-item" v-for="s in scenarios" :key="s.id">
        <button
          type="button"
          class="nav-link"
          :class="{ active: activeId === s.id }"
          @click="activeId = s.id"
        >
          {{ s.label }}
        </button>
      </li>
    </ul>
    <component :is="activeScenario.component" />
  </div>
</template>
