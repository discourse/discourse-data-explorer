import { default as computed } from "discourse-common/utils/decorators";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Ember.Controller.extend(ModalFunctionality, {
  notReady: Ember.computed.not("ready"),

  adminPluginsExplorer: Ember.inject.controller(),

  @computed("queryFile")
  ready(queryFile) {
    let parsed;
    try {
      parsed = JSON.parse(queryFile);
    } catch (e) {
      return false;
    }

    return !!parsed["query"];
  },

  actions: {
    doImport() {
      const object = JSON.parse(this.queryFile).query;

      // Slight fixup before creating object
      object.id = 0; // 0 means no Id yet

      this.set("loading", true);
      this.store
        .createRecord("query", object)
        .save()
        .then(query => {
          this.send("closeModal");
          this.set("loading", false);

          const parentController = this.adminPluginsExplorer;
          parentController.addCreatedRecord(query.target);
        })
        .catch(popupAjaxError);
    }
  }
});
