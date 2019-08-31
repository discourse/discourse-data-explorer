import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports-index",

  model() {
    // console.log(this.controller.target.parent.params.name)
    const group = this.modelFor("group");
    const p1 = this.store.findAll("query");
    return p1
      .then(queries => {
        return {
          model: queries,
          group: group
        };
      })
      .catch(() => {
        return { model: null };
      });
  },
  afterModel(model) {
    if (
      !model.group.get("is_group_user") &&
      !(this.currentUser && this.currentUser.admin)
    ) {
      this.transitionTo("group.members", group);
    }
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
