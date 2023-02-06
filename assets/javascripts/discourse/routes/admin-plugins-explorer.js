import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";

export default class AdminPluginsExplorer extends DiscourseRoute {
  model() {
    if (!this.currentUser.admin) {
      // display "Only available to admins" message
      return { model: null, schema: null, disallow: true, groups: null };
    }

    const groupPromise = ajax("/admin/plugins/explorer/groups.json");
    const schemaPromise = ajax("/admin/plugins/explorer/schema.json", {
      cache: true,
    });
    const queryPromise = this.store.findAll("query");

    return groupPromise.then((groups) => {
      let groupNames = {};
      groups.forEach((g) => {
        groupNames[g.id] = g.name;
      });
      return schemaPromise.then((schema) => {
        return queryPromise.then((model) => {
          model.forEach((query) => {
            query.set(
              "group_names",
              (query.group_ids || []).map((id) => groupNames[id])
            );
          });
          return { model, schema, groups };
        });
      });
    });
  }

  setupController(controller, model) {
    controller.setProperties(model);
  }
}
