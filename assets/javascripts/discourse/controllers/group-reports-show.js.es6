import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";

export default Ember.Controller.extend({
  showResults: false,
  explain: false,
  loading: false,
  results: Ember.computed.alias("model.results"),
  hasParams: Ember.computed.gt("model.param_info.length", 0),

  actions: {
    run() {
      this.setProperties({ loading: true, showResults: false });
      ajax(`/g/${this.get("group.name")}/reports/${this.model.id}/run`, {
        type: "POST",
        data: {
          params: JSON.stringify(this.model.params),
          explain: this.explain
        }
      })
        .then(result => {
          this.set("results", result);
          if (!result.success) {
            return;
          }

          this.set("showResults", true);
        })
        .catch(err => {
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
