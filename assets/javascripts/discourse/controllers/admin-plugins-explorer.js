import { tracked } from "@glimmer/tracking";
import Controller from "@ember/controller";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { Promise } from "rsvp";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { bind } from "discourse-common/utils/decorators";
import I18n from "I18n";
import QueryHelp from "discourse/plugins/discourse-data-explorer/discourse/components/modal/query-help";
import { ParamValidationError } from "discourse/plugins/discourse-data-explorer/discourse/components/param-input-form";
import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";

const NoQuery = Query.create({ name: "No queries", fake: true, group_ids: [] });

export default class PluginsExplorerController extends Controller {
  @service modal;
  @service dialog;
  @service appEvents;
  @service router;

  @tracked sortByProperty = "last_run_at";
  @tracked sortDescending = true;
  @tracked params;
  @tracked search;
  @tracked newQueryName;
  @tracked showCreate;
  @tracked editingName = false;
  @tracked editingQuery = false;
  @tracked selectedQueryId;
  @tracked loading = false;
  @tracked showResults = false;
  @tracked hideSchema = false;
  @tracked results = this.selectedItem.results;
  @tracked dirty = false;

  queryParams = ["params", { selectedQueryId: "id" }];
  explain = false;
  acceptedImportFileTypes = ["application/json"];
  order = null;
  form = null;

  get validQueryPresent() {
    return !!this.selectedItem.id;
  }

  get saveDisabled() {
    return !this.dirty;
  }

  get runDisabled() {
    return this.dirty;
  }

  get sortedQueries() {
    const sortedQueries = this.model.sortBy(this.sortByProperty);
    return this.sortDescending ? sortedQueries.reverse() : sortedQueries;
  }

  get parsedParams() {
    return this.params ? JSON.parse(this.params) : null;
  }

  get filteredContent() {
    const regexp = new RegExp(this.search, "i");
    return this.sortedQueries.filter(
      (result) => regexp.test(result.name) || regexp.test(result.description)
    );
  }

  get createDisabled() {
    return (this.newQueryName || "").trim().length === 0;
  }

  get selectedItem() {
    const query = this.model.findBy("id", parseInt(this.selectedQueryId, 10));
    return query || NoQuery;
  }

  get editDisabled() {
    return parseInt(this.selectedQueryId, 10) < 0 ? true : false;
  }

  get groupOptions() {
    return this.groups
      .filter((g) => g.id !== 0)
      .map((g) => {
        return { id: g.id, name: g.name };
      });
  }

  get othersDirty() {
    return !!this.model.find((q) => q !== this.selectedItem && this.dirty);
  }

  addCreatedRecord(record) {
    this.model.pushObject(record);
    this.selectedQueryId = record.id;
    this.dirty = false;
    this.setProperties({
      showResults: false,
      results: null,
      editingName: true,
      editingQuery: true,
    });
  }

  @action
  async save() {
    try {
      this.loading = true;
      await this.selectedItem.save();

      this.dirty = false;
      this.editingName = false;
    } catch (error) {
      popupAjaxError(error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  @action
  saveAndRun() {
    this.save().then(() => this.run());
  }

  async _importQuery(file) {
    const json = await this._readFileAsTextAsync(file);
    const query = this._parseQuery(json);
    const record = this.store.createRecord("query", query);
    const response = await record.save();
    return response.target;
  }

  _parseQuery(json) {
    const parsed = JSON.parse(json);
    const query = parsed.query;
    if (!query || !query.sql) {
      throw new TypeError();
    }
    query.id = 0; // 0 means no Id yet
    return query;
  }

  _readFileAsTextAsync(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;

      reader.readAsText(file);
    });
  }

  @bind
  dragMove(e) {
    if (!e.movementY && !e.movementX) {
      return;
    }

    const editPane = document.querySelector(".query-editor");
    const target = editPane.querySelector(".panels-flex");
    const grippie = editPane.querySelector(".grippie");

    // we need to get the initial height / width of edit pane
    // before we manipulate the size
    if (!this.initialPaneWidth && !this.originalPaneHeight) {
      this.originalPaneWidth = target.clientWidth;
      this.originalPaneHeight = target.clientHeight;
    }

    const newHeight = Math.max(
      this.originalPaneHeight,
      target.clientHeight + e.movementY
    );
    const newWidth = Math.max(
      this.originalPaneWidth,
      target.clientWidth + e.movementX
    );

    target.style.height = newHeight + "px";
    target.style.width = newWidth + "px";
    grippie.style.width = newWidth + "px";
    this.appEvents.trigger("ace:resize");
  }

  @bind
  didStartDrag() {}

  @bind
  didEndDrag() {}

  @bind
  scrollTop() {
    window.scrollTo(0, 0);
    this.editingName = false;
    this.editingQuery = false;
  }

  @action
  updateGroupIds(value) {
    this.dirty = true;
    this.selectedItem.set("group_ids", value);
  }

  @action
  updateHideSchema(value) {
    this.hideSchema = value;
  }

  @action
  async import(files) {
    try {
      this.loading = true;
      const file = files[0];
      const record = await this._importQuery(file);
      this.addCreatedRecord(record);
    } catch (e) {
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
    } finally {
      this.loading = false;
      this.dirty = true;
    }
  }

  @action
  displayCreate() {
    this.showCreate = true;
  }

  @action
  editName() {
    this.editingName = true;
  }

  @action
  editQuery() {
    this.editingQuery = true;
  }

  @action
  download() {
    window.open(this.selectedItem.downloadUrl, "_blank");
  }

  @action
  goHome() {
    this.order = null;
    this.showResults = false;
    this.selectedQueryId = null;
    this.params = null;
    this.sortByProperty = "last_run_at";
    this.sortDescending = true;
    this.router.transitionTo({ queryParams: { id: null, params: null } });
  }

  @action
  showHelpModal() {
    this.modal.show(QueryHelp);
  }

  @action
  resetParams() {
    this.selectedItem.resetParams();
  }

  @action
  updateSortProperty(property) {
    if (this.sortByProperty === property) {
      this.sortDescending = !this.sortDescending;
    } else {
      this.sortByProperty = property;
      this.sortDescending = true;
    }
  }

  @action
  async create() {
    try {
      const name = this.newQueryName.trim();
      this.loading = true;
      this.showCreate = false;
      const result = await this.store.createRecord("query", { name }).save();
      this.addCreatedRecord(result.target);
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.loading = false;
      this.dirty = true;
    }
  }

  @action
  async discard() {
    try {
      this.loading = true;
      const result = await this.store.find("query", this.selectedItem.id);
      this.selectedItem.setProperties(
        result.getProperties(Query.updatePropertyNames)
      );
      if (
        !this.selectedItem.group_ids ||
        !Array.isArray(this.selectedItem.group_ids)
      ) {
        this.selectedItem.set("group_ids", []);
      }
      this.dirty = false;
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.loading = false;
    }
  }

  @action
  async destroyQuery() {
    try {
      this.loading = true;
      this.showResults = false;
      await this.store.destroyRecord("query", this.selectedItem);
      this.selectedItem.set("destroyed", true);
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.loading = false;
    }
  }

  @action
  async recover() {
    try {
      this.loading = true;
      this.showResults = true;
      await this.selectedItem.save();
      this.selectedItem.set("destroyed", false);
    } catch (error) {
      popupAjaxError(error);
    } finally {
      this.loading = false;
    }
  }

  @action
  onRegisterApi(form) {
    this.form = form;
  }

  @action
  updateSearch(value) {
    this.search = value;
  }

  @action
  updateNewQueryName(value) {
    this.newQueryName = value;
  }

  @action
  setDirty() {
    this.dirty = true;
  }

  @action
  exitEdit() {
    this.editingName = false;
  }

  @action
  async run() {
    let params = null;
    if (this.selectedItem.hasParams) {
      try {
        params = await this.form?.submit();
      } catch (err) {
        if (err instanceof ParamValidationError) {
          return;
        }
      }
      if (params == null) {
        return;
      }
    }
    this.setProperties({
      loading: true,
      showResults: false,
      params: JSON.stringify(params),
    });

    ajax("/admin/plugins/explorer/queries/" + this.selectedItem.id + "/run", {
      type: "POST",
      data: {
        params: JSON.stringify(params),
        explain: this.explain,
      },
    })
      .then((result) => {
        this.results = result;
        if (!result.success) {
          this.showResults = false;
          return;
        }
        this.showResults = true;
      })
      .catch((err) => {
        this.showResults = false;
        if (err.jqXHR && err.jqXHR.status === 422 && err.jqXHR.responseJSON) {
          this.results = err.jqXHR.responseJSON;
        } else {
          popupAjaxError(err);
        }
      })
      .finally(() => (this.loading = false));
  }
}
