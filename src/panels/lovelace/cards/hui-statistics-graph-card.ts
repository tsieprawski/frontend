import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import "../../../components/ha-card";
import "../../../components/chart/statistics-charts";
import { HomeAssistant } from "../../../types";
import { hasConfigOrEntitiesChanged } from "../common/has-changed";
import { processConfigEntities } from "../common/process-config-entities";
import { LovelaceCard } from "../types";
import { StatisticsGraphCardConfig } from "./types";
import { fetchStatistics, Statistics } from "../../../data/history";

@customElement("hui-statistics-graph-card")
export class HuiStatisticsGraphCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _statistics?: Statistics;

  @state() private _config?: StatisticsGraphCardConfig;

  private _entities: string[] = [];

  private _names: Record<string, string> = {};

  private _fetching = false;

  public getCardSize(): number {
    return this._config?.title ? 2 : 0 + 2 * (this._entities?.length || 1);
  }

  public setConfig(config: StatisticsGraphCardConfig): void {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("Entities need to be an array");
    }

    if (!config.entities.length) {
      throw new Error("You must include at least one entity");
    }

    this._config = config;
    const configEntities = config.entities
      ? processConfigEntities(config.entities)
      : [];

    configEntities.forEach((entity) => {
      this._entities.push(entity.entity);
      if (entity.name) {
        this._names[entity.entity] = entity.name;
      }
    });
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("_statistics")) {
      return true;
    }
    return hasConfigOrEntitiesChanged(this, changedProps);
  }

  public willUpdate(changedProps: PropertyValues) {
    super.updated(changedProps);
    if (!this._config || !changedProps.has("_config")) {
      return;
    }

    const oldConfig = changedProps.get("_config") as
      | StatisticsGraphCardConfig
      | undefined;

    if (oldConfig?.entities !== this._config.entities) {
      this._getStatistics();
    }
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <ha-card .header="${this._config.title}">
        <div
          class="content ${classMap({
            "has-header": !!this._config.title,
          })}"
        >
          <statistics-charts
            .hass=${this.hass}
            .isLoadingData=${!this._statistics}
            .statisticsData=${this._statistics}
            .names=${this._names}
          ></statistics-charts>
        </div>
      </ha-card>
    `;
  }

  private async _getStatistics(): Promise<void> {
    if (this._fetching) {
      return;
    }
    this._fetching = true;
    try {
      this._statistics = await fetchStatistics(
        this.hass!,
        new Date("2020-01-01"),
        undefined,
        this._entities.join()
      );
    } finally {
      this._fetching = false;
    }
  }

  static get styles(): CSSResultGroup {
    return css`
      ha-card {
        height: 100%;
      }
      .content {
        padding: 16px;
      }
      .has-header {
        padding-top: 0;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-statistics-graph-card": HuiStatisticsGraphCard;
  }
}
