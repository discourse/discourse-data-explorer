import Controller from "@ember/controller";
import showModal from "discourse/lib/show-modal";
import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import discourseComputed, {
  bind,
  observes,
} from "discourse-common/utils/decorators";
import I18n from "I18n";
import { Promise } from "rsvp";
import { inject as service } from "@ember/service";
import { get } from "@ember/object";
import { not, reads, sort } from "@ember/object/computed";

const NoQuery = Query.create({ name: "No queries", fake: true, group_ids: [] });

export default Controller.extend({
  dialog: service(),
  queryParams: { selectedQueryId: "id", params: "params" },
  selectedQueryId: null,
  editDisabled: false,
  showResults: false,
  hideSchema: false,
  loading: false,
  explain: false,

  saveDisabled: not("selectedItem.dirty"),
  runDisabled: reads("selectedItem.dirty"),
  results: reads("selectedItem.results"),

  asc: null,
  order: null,
  editing: false,
  everEditing: false,
  showRecentQueries: true,
  sortBy: ["last_run_at:desc"],
  sortedQueries: sort("model", "sortBy"),

  @discourseComputed("params")
  parsedParams(params) {
    return params ? JSON.parse(params) : null;
  },

  @discourseComputed
  acceptedImportFileTypes() {
    return ["application/json"];
  },

  @discourseComputed("search", "sortBy")
  filteredContent(search) {
    const regexp = new RegExp(search, "i");
    return this.sortedQueries.filter(
      (result) => regexp.test(result.name) || regexp.test(result.description)
    );
  },

  @discourseComputed("newQueryName")
  createDisabled(newQueryName) {
    return (newQueryName || "").trim().length === 0;
  },

  @discourseComputed("selectedQueryId")
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

  @discourseComputed("selectedItem", "editing")
  selectedGroupNames() {
    const groupIds = this.selectedItem.group_ids || [];
    const groupNames = groupIds.map((id) => {
      return this.groupOptions.find((groupOption) => groupOption.id === id)
        .name;
    });
    return groupNames.join(", ");
  },

  @discourseComputed("groups")
  groupOptions(groups) {
    return groups
      .filter((g) => g.id !== 0)
      .map((g) => {
        return { id: g.id, name: g.name };
      });
  },

  @discourseComputed("selectedItem", "selectedItem.dirty")
  othersDirty(selectedItem) {
    return !!this.model.find((q) => q !== selectedItem && q.dirty);
  },

  @observes("editing")
  setEverEditing() {
    if (this.editing && !this.everEditing) {
      this.set("everEditing", true);
    }
  },

  addCreatedRecord(record) {
    this.model.pushObject(record);
    this.set("selectedQueryId", get(record, "id"));
    this.selectedItem.set("dirty", false);
    this.setProperties({
      showResults: false,
      results: null,
      editing: true,
    });
  },

  save() {
    this.set("loading", true);
    if (this.get("selectedItem.description") === "") {
      this.set("selectedItem.description", "");
    }

    return this.selectedItem
      .save()
      .then(() => {
        const query = this.selectedItem;
        query.markNotDirty();
        this.set("editing", false);
      })
      .catch((x) => {
        popupAjaxError(x);
        throw x;
      })
      .finally(() => this.set("loading", false));
  },

  async _importQuery(file) {
    const json = await this._readFileAsTextAsync(file);
    const query = this._parseQuery(json);
    const record = this.store.createRecord("query", query);
    const response = await record.save();
    return response.target;
  },

  _parseQuery(json) {
    const parsed = JSON.parse(json);
    const query = parsed.query;
    if (!query || !query.sql) {
      throw new TypeError();
    }
    query.id = 0; // 0 means no Id yet
    return query;
  },

  _readFileAsTextAsync(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;

      reader.readAsText(file);
    });
  },

  @bind
  scrollTop() {
    window.scrollTo(0, 0);
    this.setProperties({ editing: false, everEditing: false });
  },

  actions: {
    dummy() {},

    expandSchema() {
      this.set("hideSchema", false);
    },

    import(files) {
      this.set("loading", true);
      const file = files[0];
      this._importQuery(file)
        .then((record) => this.addCreatedRecord(record))
        .catch((e) => {
          if (e.jqXHR) {
            popupAjaxError(e);
          } else if (e instanceof SyntaxError) {
            this.dialog.alert(I18n.t("explorer.import.unparseable_json"));
          } else if (e instanceof TypeError) {
            this.dialog.alert(I18n.t("explorer.import.wrong_json"));
          } else {
            this.dialog.alert(I18n.t("errors.desc.unknown"));
            // eslint-disable-next-line no-console
            console.error(e);
          }
        })
        .finally(() => {
          this.set("loading", false);
        });
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

    goHome() {
      this.setProperties({
        asc: null,
        order: null,
        showResults: false,
        editDisabled: false,
        showRecentQueries: true,
        selectedQueryId: null,
        params: null,
        sortBy: ["last_run_at:desc"],
      });
      this.transitionToRoute({ queryParams: { id: null, params: null } });
    },

    showHelpModal() {
      showModal("query-help");
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
        showRecentQueries: false,
      });
      this.store
        .createRecord("query", { name })
        .save()
        .then((result) => this.addCreatedRecord(result.target))
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    },

    discard() {
      this.set("loading", true);
      this.store
        .find("query", this.get("selectedItem.id"))
        .then((result) => {
          const query = this.get("selectedItem");
          query.setProperties(result.getProperties(Query.updatePropertyNames));
          if (!query.group_ids || !Array.isArray(query.group_ids)) {
            query.set("group_ids", []);
          }
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

    // This is necessary with glimmers one way data stream to get the child's
    // changes of 'params' to bubble up.
    updateParams(identifier, value) {
      this.selectedItem.set(`params.${identifier}`, value);
    },

    run() {
      if (this.get("selectedItem.dirty")) {
        return;
      }
      if (this.runDisabled) {
        return;
      }

      this.setProperties({
        loading: true,
        showResults: false,
        params: JSON.stringify(this.selectedItem.params),
      });

      ajax(
        "/admin/plugins/explorer/queries/" +
          this.get("selectedItem.id") +
          "/run",
        {
          type: "POST",
          data: {
            params: JSON.stringify(this.get("selectedItem.params")),
            explain: this.explain,
          },
        }
      )
        .then((result) => {
          this.set("results", result);
          if (!result.success) {
            this.set("showResults", false);
            return;
          }

          this.set("showResults", true);
        })
        .catch((err) => {
          this.set("showResults", false);
          if (err.jqXHR && err.jqXHR.status === 422 && err.jqXHR.responseJSON) {
            this.set("results", err.jqXHR.responseJSON);
          } else {
            popupAjaxError(err);
          }
        })
        .finally(() => this.set("loading", false));
    },
  },
});
