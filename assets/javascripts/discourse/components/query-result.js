import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { capitalize } from "@ember/string";
import { ajax } from "discourse/lib/ajax";
import Badge from "discourse/models/badge";
import getURL from "discourse-common/lib/get-url";
import I18n from "I18n";
import BadgeViewComponent from "./result-types/badge";
import CategoryViewComponent from "./result-types/category";
import GroupViewComponent from "./result-types/group";
import HtmlViewComponent from "./result-types/html";
import JsonViewComponent from "./result-types/json";
import PostViewComponent from "./result-types/post";
import ReltimeViewComponent from "./result-types/reltime";
import TextViewComponent from "./result-types/text";
import TopicViewComponent from "./result-types/topic";
import UrlViewComponent from "./result-types/url";
import UserViewComponent from "./result-types/user";

const VIEW_COMPONENTS = {
  topic: TopicViewComponent,
  text: TextViewComponent,
  post: PostViewComponent,
  reltime: ReltimeViewComponent,
  badge: BadgeViewComponent,
  url: UrlViewComponent,
  user: UserViewComponent,
  group: GroupViewComponent,
  html: HtmlViewComponent,
  json: JsonViewComponent,
  category: CategoryViewComponent,
};

export default class QueryResult extends Component {
  @service site;
  @tracked chartDisplayed = false;

  get colRender() {
    return this.args.content.colrender || {};
  }

  get rows() {
    return this.args.content.rows;
  }

  get columns() {
    return this.args.content.columns;
  }

  get params() {
    return this.args.content.params;
  }

  get explainText() {
    return this.args.content.explain;
  }

  get chartDatasetName() {
    return this.columnNames[1];
  }

  get columnNames() {
    if (!this.columns) {
      return [];
    }
    return this.columns.map((colName) => {
      if (colName.endsWith("_id")) {
        return colName.slice(0, -3);
      }
      const dIdx = colName.indexOf("$");
      if (dIdx >= 0) {
        return colName.substring(dIdx + 1);
      }
      return colName;
    });
  }

  get columnComponents() {
    if (!this.columns) {
      return [];
    }
    return this.columns.map((_, idx) => {
      let type = "text";
      if (this.colRender[idx]) {
        type = this.colRender[idx];
      }
      return { name: type, component: VIEW_COMPONENTS[type] };
    });
  }

  get chartValues() {
    // return an array with the second value of this.row
    return this.rows.mapBy(1);
  }

  get colCount() {
    return this.columns.length;
  }

  get resultCount() {
    const count = this.args.content.result_count;
    if (count === this.args.content.default_limit) {
      return I18n.t("explorer.max_result_count", { count });
    } else {
      return I18n.t("explorer.result_count", { count });
    }
  }

  get duration() {
    return I18n.t("explorer.run_time", {
      value: I18n.toNumber(this.args.content.duration, { precision: 1 }),
    });
  }

  get parameterAry() {
    let arr = [];
    for (let key in this.params) {
      if (this.params.hasOwnProperty(key)) {
        arr.push({ key, value: this.params[key] });
      }
    }
    return arr;
  }

  get transformedUserTable() {
    return transformedRelTable(this.args.content.relations.user);
  }

  get transformedBadgeTable() {
    return transformedRelTable(this.args.content.relations.badge, Badge);
  }

  get transformedPostTable() {
    return transformedRelTable(this.args.content.relations.post);
  }

  get transformedTopicTable() {
    return transformedRelTable(this.args.content.relations.topic);
  }

  get transformedGroupTable() {
    return transformedRelTable(this.site.groups);
  }

  get canShowChart() {
    const hasTwoColumns = this.colCount === 2;
    const secondColumnContainsNumber =
      this.resultCount[0] > 0 && typeof this.rows[0][1] === "number";
    const secondColumnContainsId = this.colRender[1];

    return (
      hasTwoColumns && secondColumnContainsNumber && !secondColumnContainsId
    );
  }

  get chartLabels() {
    const labelSelectors = {
      user: (user) => user.username,
      badge: (badge) => badge.name,
      topic: (topic) => topic.title,
      group: (group) => group.name,
      category: (category) => category.name,
    };

    const relationName = this.colRender[0];
    if (relationName) {
      const lookupFunc = this[`lookup${capitalize(relationName)}`];
      const labelSelector = labelSelectors[relationName];

      if (lookupFunc && labelSelector) {
        return this.rows.map((r) => {
          const relation = lookupFunc.call(this, r[0]);
          const label = labelSelector(relation);
          return this._cutChartLabel(label);
        });
      }
    }

    return this.rows.map((r) => this._cutChartLabel(r[0]));
  }

  lookupUser(id) {
    return this.transformedUserTable[id];
  }
  lookupBadge(id) {
    return this.transformedBadgeTable[id];
  }
  lookupPost(id) {
    return this.transformedPostTable[id];
  }
  lookupTopic(id) {
    return this.transformedTopicTable[id];
  }
  lookupGroup(id) {
    return this.transformedGroupTable[id];
  }

  lookupCategory(id) {
    return this.site.categoriesById[id];
  }

  _cutChartLabel(label) {
    const labelString = label.toString();
    if (labelString.length > 25) {
      return `${labelString.substring(0, 25)}...`;
    } else {
      return labelString;
    }
  }

  @action
  downloadResultJson() {
    this._downloadResult("json");
  }

  @action
  downloadResultCsv() {
    this._downloadResult("csv");
  }

  @action
  showChart() {
    this.chartDisplayed = true;
  }

  @action
  hideChart() {
    this.chartDisplayed = false;
  }

  _download_url() {
    return this.args.group
      ? `/g/${this.args.group.name}/reports/`
      : "/admin/plugins/explorer/queries/";
  }

  _downloadResult(format) {
    // Create a frame to submit the form in (?)
    // to avoid leaving an about:blank behind
    let windowName = randomIdShort();
    const newWindowContents =
      "<style>body{font-size:36px;display:flex;justify-content:center;align-items:center;}</style><body>Click anywhere to close this window once the download finishes.<script>window.onclick=function(){window.close()};</script>";

    window.open("data:text/html;base64," + btoa(newWindowContents), windowName);

    let form = document.createElement("form");
    form.setAttribute("id", "query-download-result");
    form.setAttribute("method", "post");
    form.setAttribute(
      "action",
      getURL(
        this._download_url() +
          this.args.query.id +
          "/run." +
          format +
          "?download=1"
      )
    );
    form.setAttribute("target", windowName);
    form.setAttribute("style", "display:none;");

    function addInput(name, value) {
      let field;
      field = document.createElement("input");
      field.setAttribute("name", name);
      field.setAttribute("value", value);
      form.appendChild(field);
    }

    addInput("params", JSON.stringify(this.params));
    addInput("explain", this.explainText);
    addInput("limit", "1000000");

    ajax("/session/csrf.json").then((csrf) => {
      addInput("authenticity_token", csrf.csrf);

      document.body.appendChild(form);
      form.submit();
      schedule("afterRender", () => document.body.removeChild(form));
    });
  }
}

function randomIdShort() {
  return "xxxxxxxx".replace(/[xy]/g, () => {
    /*eslint-disable*/
    return ((Math.random() * 16) | 0).toString(16);
    /*eslint-enable*/
  });
}

function transformedRelTable(table, modelClass) {
  const result = {};
  table.forEach((item) => {
    if (modelClass) {
      result[item.id] = modelClass.create(item);
    } else {
      result[item.id] = item;
    }
  });
  return result;
}
