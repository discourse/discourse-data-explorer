import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";

export default DiscourseRoute.extend({
  controllerName: "group-reports-index",

  model() {
    const group = this.modelFor("group");
    return ajax(`/g/${group.name}/reports`)
      .then(queries => {
        return {
          model: queries,
          group
        };
      })
      .catch(() => this.transitionTo("group.members", group));
  },

  afterModel(model) {
    if (
      !model.group.get("is_group_user") &&
      !(this.currentUser && this.currentUser.admin)
    ) {
      this.transitionTo("group.members", model.group);
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
