import loadScript from "discourse/lib/load-script";
import { default as computed } from "discourse-common/utils/decorators";
import themeColor from "../lib/themeColor";

export default Ember.Component.extend({
  barsColor: themeColor("--tertiary"),
  barsHoverColor: themeColor("--tertiary-high"),
  gridColor: themeColor("--primary-low"),
  labelsColor: themeColor("--primary-medium"),
  chart: undefined,

  @computed("data", "options")
  config(data, options) {
    return {
      type: "bar",
      data: data,
      options: options,
    };
  },

  @computed("labels.[]", "values.[]", "datasetName")
  data(labels, values, datasetName) {
    return {
      labels: labels,
      datasets: [
        {
          label: datasetName,
          data: values,
          backgroundColor: this.barsColor,
          hoverBackgroundColor: this.barsHoverColor,
        },
      ],
    };
  },

  @computed
  options() {
    return {
      scales: {
        legend: {
          labels: {
            fontColor: this.labelsColor,
          },
        },
        xAxes: [
          {
            gridLines: {
              color: this.gridColor,
              zeroLineColor: this.gridColor,
            },
            ticks: {
              fontColor: this.labelsColor,
            },
          },
        ],
        yAxes: [
          {
            gridLines: {
              color: this.gridColor,
              zeroLineColor: this.gridColor,
            },
            ticks: {
              beginAtZero: true,
              fontColor: this.labelsColor,
            },
          },
        ],
      },
    };
  },

  didInsertElement() {
    this._super(...arguments);
    this._initChart();
  },

  didUpdate() {
    this._super(...arguments);
    this.chart.data = this.get("data");
    this.chart.update();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.chart.destroy();
  },

  _initChart() {
    loadScript("/javascripts/Chart.min.js").then(() => {
      const canvas = this.element.querySelector("canvas");
      const context = canvas.getContext("2d");
      const config = this.get("config");
      // eslint-disable-next-line
      this.chart = new Chart(context, config);
    });
  },
});
