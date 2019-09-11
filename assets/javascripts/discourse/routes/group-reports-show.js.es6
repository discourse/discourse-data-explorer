import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports-show",

  model(params) {
    const group = this.modelFor("group");
    return ajax(`/g/${group.name}/reports/${params.query_id}`)
      .then(response => {
        return {
          model: Object.assign({ params: {} }, response.query),
          group: group
        };
      })
      .catch(err => {
        this.transitionTo("group.members", group);
      });
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
