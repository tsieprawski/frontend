import { HassEntity } from "home-assistant-js-websocket";
import { LatLngTuple } from "leaflet";
import { html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators";
import { HomeAssistant } from "../../types";
import "./ha-chart-base";

@customElement("state-history-map")
export class StateHistoryMap extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public data: string[] = [];

  @property({ type: Boolean }) public names = false;

  @state() private _mapEntities?: Record<string, unknown>[];

  @state() private _mapPaths?: Record<unknown>[];

  protected render() {
    return html`
      <ha-map
        .hass=${this.hass}
        .entities=${this._mapEntities}
        .paths=${this._mapPaths}
        autoFit
      ></ha-map>
    `;
  }

  public willUpdate(changedProps: PropertyValues) {
    if (changedProps.has("data")) {
      this._generateData();
    }
  }

  private _generateData() {
    const data = this.data;
    this._mapEntities = data.entities;
    this._mapPaths = data.paths;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "state-history-map": StateHistoryMap;
  }
}
