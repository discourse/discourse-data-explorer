import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports",

  model() {
    // console.log(this.controller.target.parent.params.name)
    const groupId = this.modelFor('group').id
    const p1 = this.store.findAll("query");
    return p1
      .then(queries => {
        return {
          model: queries,
          groupId: groupId
        }
      })
    .catch(() => {
      return { model: null };
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
