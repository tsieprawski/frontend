import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, property } from "lit/decorators";
import { isComponentLoaded } from "../../common/config/is_component_loaded";
import { HistoryResult } from "../../data/history";
import type { HomeAssistant } from "../../types";
import "../ha-circular-progress";
import "./state-history-chart-line";
import "./state-history-chart-timeline";
import "./state-history-map";

@customElement("state-history-charts")
class StateHistoryCharts extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public historyData!: HistoryResult;

  @property({ type: Boolean }) public names = false;

  @property({ attribute: false }) public endTime?: Date;

  @property({ type: Boolean, attribute: "up-to-now" }) public upToNow = false;

  @property({ type: Boolean, attribute: "no-single" }) public noSingle = false;

  @property({ type: Boolean }) public isLoadingData = false;

  protected render(): TemplateResult {
    if (!isComponentLoaded(this.hass, "history")) {
      return html` <div class="info">
        ${this.hass.localize("ui.components.history_charts.history_disabled")}
      </div>`;
    }

    if (this.isLoadingData && !this.historyData) {
      return html` <div class="info">
        ${this.hass.localize("ui.components.history_charts.loading_history")}
      </div>`;
    }

    if (this._isHistoryEmpty()) {
      return html` <div class="info">
        ${this.hass.localize("ui.components.history_charts.no_history_found")}
      </div>`;
    }

    const computedEndTime = this.upToNow
      ? new Date()
      : this.endTime || new Date();

    return html`
      ${this.historyData.timeline.length
        ? html`
            <state-history-chart-timeline
              .hass=${this.hass}
              .data=${this.historyData.timeline}
              .endTime=${computedEndTime}
              .noSingle=${this.noSingle}
              .names=${this.names}
            ></state-history-chart-timeline>
          `
        : html``}
      ${this.historyData.map.entities.length ||
      this.historyData.map.paths.length
        ? html`
            <state-history-map
              .hass=${this.hass}
              .data=${this.historyData.map}
              .endTime=${computedEndTime}
              .noSingle=${this.noSingle}
            ></state-history-chart-timeline>
          `
        : html``}
      ${this.historyData.line.map(
        (line) => html`
          <state-history-chart-line
            .hass=${this.hass}
            .unit=${line.unit}
            .data=${line.data}
            .identifier=${line.identifier}
            .isSingleDevice=${!this.noSingle &&
            line.data &&
            line.data.length === 1}
            .endTime=${computedEndTime}
            .names=${this.names}
          ></state-history-chart-line>
        `
      )}
    `;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return !(changedProps.size === 1 && changedProps.has("hass"));
  }

  private _isHistoryEmpty(): boolean {
    const historyDataEmpty =
      !this.historyData ||
      !this.historyData.timeline ||
      !this.historyData.map ||
      !this.historyData.line ||
      (this.historyData.timeline.length === 0 &&
        this.historyData.map.entities.length === 0 &&
        this.historyData.map.paths.length === 0 &&
        this.historyData.line.length === 0);
    return !this.isLoadingData && historyDataEmpty;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        /* height of single timeline chart = 60px */
        min-height: 60px;
      }
      .info {
        text-align: center;
        line-height: 60px;
        color: var(--secondary-text-color);
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "state-history-charts": StateHistoryCharts;
  }
}
