import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  showResults: false,
  explain: false,
  loading: false,
  results: Ember.computed.alias("model.results"),

  actions: {
    run() {
      this.setProperties({ loading: true, showResults: false });
      ajax(
        "/admin/plugins/explorer/queries/" +
          this.get("model.id") +
          "/run",
        {
          type: "POST",
          data: {
            params: JSON.stringify(this.get("model.params")),
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
  },
})
