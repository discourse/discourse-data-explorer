import showModal from "discourse/lib/show-modal";
import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import {
  default as computed,
  observes
} from "discourse-common/utils/decorators";

const NoQuery = Query.create({ name: "No queries", fake: true, group_ids: [] });

export default Ember.Controller.extend({
  queryParams: { selectedQueryId: "id" },
  selectedQueryId: null,
  editDisabled: false,
  showResults: false,
  hideSchema: false,
  loading: false,
  explain: false,

  saveDisabled: Ember.computed.not("selectedItem.dirty"),
  runDisabled: Ember.computed.reads("selectedItem.dirty"),
  results: Ember.computed.reads("selectedItem.results"),

  asc: null,
  order: null,
  editing: false,
  everEditing: false,
  showRecentQueries: true,
  sortBy: ["last_run_at:desc"],
  sortedQueries: Ember.computed.sort("model", "sortBy"),

  @computed("search", "sortBy")
  filteredContent(search) {
    const regexp = new RegExp(search, "i");
    return this.sortedQueries.filter(
      result => regexp.test(result.name) || regexp.test(result.description)
    );
  },

  @computed("newQueryName")
  createDisabled(newQueryName) {
    return (newQueryName || "").trim().length === 0;
  },

  @computed("selectedQueryId")
  selectedItem(selectedQueryId) {
    const id = parseInt(selectedQueryId, 10);
    const item = this.model.findBy("id", id);

    !isNaN(id)
      ? this.set("showRecentQueries", false)
      : this.set("showRecentQueries", true);

    if (id < 0) {
      this.set("editDisabled", true);
    }

    return item || NoQuery;
  },

  @computed("selectedItem", "editing")
  selectedGroupNames() {
    const groupIds = this.selectedItem.group_ids || [];
    const groupNames = groupIds.map(id => {
      return this.groupOptions.find(groupOption => groupOption.id === id).name;
    });
    return groupNames.join(", ");
  },

  @computed("groups")
  groupOptions(groups) {
    return groups.map(g => {
      return { id: g.id.toString(), name: g.name };
    });
  },

  @computed("selectedItem", "selectedItem.dirty")
  othersDirty(selectedItem) {
    return !!this.model.find(q => q !== selectedItem && q.dirty);
  },

  @observes("editing")
  setEverEditing() {
    if (this.editing && !this.everEditing) {
      this.set("everEditing", true);
    }
  },

  addCreatedRecord(record) {
    this.model.pushObject(record);
    this.set("selectedQueryId", Ember.get(record, "id"));
    this.selectedItem.set("dirty", false);
    this.setProperties({
      showResults: false,
      results: null,
      editing: true
    });
  },

  save() {
    this.set("loading", true);
    if (this.get("selectedItem.description") === "")
      this.set("selectedItem.description", "");

    return this.selectedItem
      .save()
      .then(() => {
        const query = this.selectedItem;
        query.markNotDirty();
        this.set("editing", false);
      })
      .catch(x => {
        popupAjaxError(x);
        throw x;
      })
      .finally(() => this.set("loading", false));
  },

  actions: {
    dummy() {},

    expandSchema() {
      this.set("hideSchema", false);
    },

    importQuery() {
      showModal("import-query");
      this.set("showCreate", false);
    },

    showCreate() {
      this.set("showCreate", true);
    },

    editName() {
      this.set("editing", true);
    },

    download() {
      window.open(this.get("selectedItem.downloadUrl"), "_blank");
    },

    scrollTop() {
      window.scrollTo(0, 0);
      this.setProperties({ editing: false, everEditing: false });
    },

    goHome() {
      this.setProperties({
        asc: null,
        order: null,
        showResults: false,
        editDisabled: false,
        selectedQueryId: null,
        sortBy: ["last_run_at:desc"]
      });
      this.send("refreshModel");
      this.transitionToRoute("adminPlugins.explorer");
    },

    resetParams() {
      this.selectedItem.resetParams();
    },

    saveDefaults() {
      this.selectedItem.saveDefaults();
    },

    save() {
      this.save();
    },

    saverun() {
      this.save().then(() => this.send("run"));
    },

    sortByProperty(property) {
      if (this.sortBy[0] === `${property}:desc`) {
        this.set("sortBy", [`${property}:asc`]);
      } else {
        this.set("sortBy", [`${property}:desc`]);
      }
    },

    create() {
      const name = this.newQueryName.trim();
      this.setProperties({
        loading: true,
        showCreate: false,
        showRecentQueries: false
      });
      this.store
        .createRecord("query", { name })
        .save()
        .then(result => this.addCreatedRecord(result.target))
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    },

    discard() {
      this.set("loading", true);
      this.store
        .find("query", this.get("selectedItem.id"))
        .then(result => {
          const query = this.get("selectedItem");
          query.setProperties(result.getProperties(Query.updatePropertyNames));
          if (!query.group_ids || !Array.isArray(query.group_ids))
            query.set("group_ids", []);
          query.markNotDirty();
          this.set("editing", false);
        })
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    },

    destroy() {
      const query = this.selectedItem;
      this.setProperties({ loading: true, showResults: false });
      this.store
        .destroyRecord("query", query)
        .then(() => query.set("destroyed", true))
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    },

    recover() {
      const query = this.selectedItem;
      this.setProperties({ loading: true, showResults: true });
      query
        .save()
        .then(() => query.set("destroyed", false))
        .catch(popupAjaxError)
        .finally(() => {
          this.set("loading", false);
        });
    },

    run() {
      if (this.get("selectedItem.dirty")) {
        return;
      }
      if (this.runDisabled) {
        return;
      }

      this.setProperties({ loading: true, showResults: false });
      ajax(
        "/admin/plugins/explorer/queries/" +
          this.get("selectedItem.id") +
          "/run",
        {
          type: "POST",
          data: {
            params: JSON.stringify(this.get("selectedItem.params")),
            explain: this.explain
          }
        }
      )
        .then(result => {
          this.set("results", result);
          if (!result.success) {
            this.set("showResults", false);
            return;
          }

          this.set("showResults", true);
        })
        .catch(err => {
          this.set("showResults", false);
          if (err.jqXHR && err.jqXHR.status === 422 && err.jqXHR.responseJSON) {
            this.set("results", err.jqXHR.responseJSON);
          } else {
            popupAjaxError(err);
          }
        })
        .finally(() => this.set("loading", false));
    }
  }
});
