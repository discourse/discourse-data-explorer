import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";

export default class AdminPluginsExplorerIndex extends DiscourseRoute {
  model() {
    if (!this.currentUser.admin) {
      // display "Only available to admins" message
      return { model: null, schema: null, disallow: true, groups: null };
    }

    const groupPromise = ajax("/admin/plugins/explorer/groups.json");
    const queryPromise = this.store.findAll("query");

    return groupPromise.then((groups) => {
      let groupNames = {};
      groups.forEach((g) => {
        groupNames[g.id] = g.name;
      });
      return queryPromise.then((model) => {
        model.forEach((query) => {
          query.set(
            "group_names",
            (query.group_ids || []).map((id) => groupNames[id])
          );
        });
        return { model, groups };
      });
    });
  }

  setupController(controller, model) {
    controller.setProperties(model);
  }
}
