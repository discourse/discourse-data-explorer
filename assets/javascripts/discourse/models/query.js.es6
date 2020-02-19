import {
  default as computed,
  on,
  observes
} from "discourse-common/utils/decorators";
import RestModel from "discourse/models/rest";

const Query = RestModel.extend({
  dirty: false,
  params: {},
  results: null,

  @on("init")
  _init() {
    this._super(...arguments);

    this.set("dirty", false);
  },

  @on("init")
  @observes("param_info")
  _initParams() {
    this.resetParams();
  },

  @observes("name", "description", "sql", "group_ids")
  markDirty() {
    this.set("dirty", true);
  },

  markNotDirty() {
    this.set("dirty", false);
  },

  hasParams: Ember.computed.reads("param_info.length"),

  resetParams() {
    const newParams = {};
    const oldParams = this.params;
    const paramInfo = this.param_info || [];
    paramInfo.forEach(pinfo => {
      const name = pinfo.identifier;
      if (oldParams[pinfo.identifier]) {
        newParams[name] = oldParams[name];
      } else if (pinfo["default"] !== null) {
        newParams[name] = pinfo["default"];
      } else if (pinfo["type"] === "boolean") {
        newParams[name] = "false";
      } else {
        newParams[name] = "";
      }
    });
    this.set("params", newParams);
  },

  @computed("id")
  downloadUrl(id) {
    // TODO - can we change this to use the store/adapter?
    return Discourse.getURL(
      `/admin/plugins/explorer/queries/${id}.json?export=1`
    );
  },

  createProperties() {
    if (this.sql) {
      // Importing
      return this.updateProperties();
    }
    return this.getProperties("name");
  },

  updateProperties() {
    const props = this.getProperties(Query.updatePropertyNames);
    if (this.destroyed) {
      props.id = this.id;
    }
    return props;
  }
});

Query.reopenClass({
  updatePropertyNames: [
    "name",
    "description",
    "sql",
    "created_by",
    "created_at",
    "group_ids",
    "last_run_at"
  ]
});

export default Query;
