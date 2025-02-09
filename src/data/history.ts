import { HassEntity } from "home-assistant-js-websocket";
import { LatLngTuple } from "leaflet";
import { computeDomain } from "../common/entity/compute_domain";
import { computeStateDisplay } from "../common/entity/compute_state_display";
import { computeStateDomain } from "../common/entity/compute_state_domain";
import { computeStateName } from "../common/entity/compute_state_name";
import { getColorByIndex } from "../common/color/colors";
import { LocalizeFunc } from "../common/translations/localize";
import { HomeAssistant } from "../types";
import { FrontendLocaleData } from "./translation";

const DOMAINS_USE_LAST_UPDATED = ["climate", "humidifier", "water_heater"];
const LINE_ATTRIBUTES_TO_KEEP = [
  "temperature",
  "current_temperature",
  "target_temp_low",
  "target_temp_high",
  "hvac_action",
  "humidity",
  "mode",
];

export interface LineChartState {
  state: string;
  last_changed: string;
  attributes?: Record<string, any>;
}

export interface LineChartEntity {
  domain: string;
  name: string;
  entity_id: string;
  states: LineChartState[];
}

export interface LineChartUnit {
  unit: string;
  identifier: string;
  data: LineChartEntity[];
}

export interface TimelineState {
  state_localize: string;
  state: string;
  last_changed: string;
}

export interface TimelineEntity {
  name: string;
  entity_id: string;
  data: TimelineState[];
}

export interface HistoryResult {
  line: LineChartUnit[];
  timeline: TimelineEntity[];
}

export const fetchRecent = (
  hass,
  entityId,
  startTime,
  endTime,
  skipInitialState = false,
  significantChangesOnly?: boolean,
  minimalResponse = true
): Promise<HassEntity[][]> => {
  let url = "history/period";
  if (startTime) {
    url += "/" + startTime.toISOString();
  }
  url += "?filter_entity_id=" + entityId;
  if (endTime) {
    url += "&end_time=" + endTime.toISOString();
  }
  if (skipInitialState) {
    url += "&skip_initial_state";
  }
  if (significantChangesOnly !== undefined) {
    url += `&significant_changes_only=${Number(significantChangesOnly)}`;
  }
  if (minimalResponse) {
    url += "&minimal_response";
  }

  return hass.callApi("GET", url);
};

export const fetchDate = (
  hass: HomeAssistant,
  startTime: Date,
  endTime: Date,
  entityId,
  significantChangesOnly? = true,
  minimalResponse = true
): Promise<HassEntity[][]> => {
  let url = `history/period/${startTime.toISOString()}?end_time=${endTime.toISOString()}${
    entityId ? `&filter_entity_id=${entityId}` : ``
  }`;
  if (significantChangesOnly !== undefined) {
    url += `&significant_changes_only=${Number(significantChangesOnly)}`;
  }
  if (minimalResponse) {
    url += "&minimal_response";
  }
  return hass.callApi("GET", url);
};

const equalState = (obj1: LineChartState, obj2: LineChartState) =>
  obj1.state === obj2.state &&
  // Only compare attributes if both states have an attributes object.
  // When `minimal_response` is sent, only the first and last state
  // will have attributes except for domains in DOMAINS_USE_LAST_UPDATED.
  (!obj1.attributes ||
    !obj2.attributes ||
    LINE_ATTRIBUTES_TO_KEEP.every(
      (attr) => obj1.attributes![attr] === obj2.attributes![attr]
    ));

const processTimelineEntity = (
  localize: LocalizeFunc,
  language: FrontendLocaleData,
  states: HassEntity[]
): TimelineEntity => {
  const data: TimelineState[] = [];
  const last_element = states.length - 1;

  for (const state of states) {
    if (data.length > 0 && state.state === data[data.length - 1].state) {
      continue;
    }

    // Copy the data from the last element as its the newest
    // and is only needed to localize the data
    if (!state.entity_id) {
      state.attributes = states[last_element].attributes;
      state.entity_id = states[last_element].entity_id;
    }

    data.push({
      state_localize: computeStateDisplay(localize, state, language),
      state: state.state,
      last_changed: state.last_changed,
    });
  }

  return {
    name: computeStateName(states[0]),
    entity_id: states[0].entity_id,
    data,
  };
};

const processLineChartEntities = (
  unit,
  entities: HassEntity[][]
): LineChartUnit => {
  const data: LineChartEntity[] = [];

  for (const states of entities) {
    const last: HassEntity = states[states.length - 1];
    const domain = computeStateDomain(last);
    const processedStates: LineChartState[] = [];

    for (const state of states) {
      let processedState: LineChartState;

      if (DOMAINS_USE_LAST_UPDATED.includes(domain)) {
        processedState = {
          state: state.state,
          last_changed: state.last_updated,
          attributes: {},
        };

        for (const attr of LINE_ATTRIBUTES_TO_KEEP) {
          if (attr in state.attributes) {
            processedState.attributes![attr] = state.attributes[attr];
          }
        }
      } else {
        processedState = state;
      }

      if (
        processedStates.length > 1 &&
        equalState(
          processedState,
          processedStates[processedStates.length - 1]
        ) &&
        equalState(processedState, processedStates[processedStates.length - 2])
      ) {
        continue;
      }

      processedStates.push(processedState);
    }

    data.push({
      domain,
      name: computeStateName(last),
      entity_id: last.entity_id,
      states: processedStates,
    });
  }

  return {
    unit,
    identifier: entities.map((states) => states[0].entity_id).join(""),
    data,
  };
};

export const computeHistory = (
  hass: HomeAssistant,
  stateHistory: HassEntity[][],
  localize: LocalizeFunc
): HistoryResult => {
  const lineChartDevices: { [unit: string]: HassEntity[][] } = {};
  const mapEntities: string[] = [];
  const mapPaths: HaMapPaths[] = [];
  const timelineDevices: TimelineEntity[] = [];
  if (!stateHistory) {
    return { line: [], timeline: [] };
  }

  stateHistory.forEach((stateInfo) => {
    if (stateInfo.length === 0) {
      return;
    }

    const stateWithUnit = stateInfo.find(
      (state) => state.attributes && "unit_of_measurement" in state.attributes
    );

    // filter location data from states and remove all invalid locations
    const points = stateInfo.reduce(
      (accumulator: LatLngTuple[], entityState) => {
        if (entityState.attributes) {
          const latitude = entityState.attributes.latitude;
          const longitude = entityState.attributes.longitude;
          if (latitude && longitude) {
            accumulator.push([latitude, longitude] as LatLngTuple);
          }
        }
        return accumulator;
      },
      []
    ) as LatLngTuple[];

    if (points.length) {
      const entityId = stateInfo[0].entity_id;
      const color = getColorByIndex(mapEntities.length);
      mapEntities.push({
        entity_id: entityId,
        color: color,
      });
      mapPaths.push({
        points,
        color: color,
        gradualOpacity: 0.8,
      });
    }

    let unit: string | undefined;

    if (stateWithUnit) {
      unit = stateWithUnit.attributes.unit_of_measurement;
    } else {
      unit = {
        climate: hass.config.unit_system.temperature,
        counter: "#",
        humidifier: "%",
        input_number: "#",
        number: "#",
        water_heater: hass.config.unit_system.temperature,
      }[computeStateDomain(stateInfo[0])];
    }

    if (!unit) {
      timelineDevices.push(
        processTimelineEntity(localize, hass.locale, stateInfo)
      );
    } else if (unit in lineChartDevices) {
      lineChartDevices[unit].push(stateInfo);
    } else {
      lineChartDevices[unit] = [stateInfo];
    }
  });

  const unitStates = Object.keys(lineChartDevices).map((unit) =>
    processLineChartEntities(unit, lineChartDevices[unit])
  );

  return {
    line: unitStates,
    map: {
      entities: mapEntities,
      paths: mapPaths,
    },
    timeline: timelineDevices,
  };
};
