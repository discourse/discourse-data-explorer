
import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports-show",

  model(params) {
    // console.log(this.controller.target.parent.params.name)
    const p1 = this.store.find("query", parseInt(params.query_id));
    return p1
      .then(query => {
        return { model: query }
      })
  },

  setupController(controller, model) {
    controller.setProperties(model);
  },

  actions: {
    refreshModel() {
      this.refresh();
      return false;
    }
  }
});
