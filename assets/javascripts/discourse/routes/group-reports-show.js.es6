
import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports-show",

  model() {
    // console.log(this.controller.target.parent.params.name)
    const query = this.modelFor('query')
    return { model: query }
    // return p1
      // .then(queries => {
        // return {
          // model: query,
        // }
      // })
    // .catch(() => {
      // return { model: null };
    // });
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
