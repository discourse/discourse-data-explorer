import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "group-reports-index",

  model() {
    const group = this.modelFor("group");
    const p1 = ajax(`/g/${group.name}/reports`);
    return p1
      .then(queries => {
        return {
          model: queries,
          group: group
        };
      })
      .catch(() => {
        this.transitionTo("group.members", group);
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
