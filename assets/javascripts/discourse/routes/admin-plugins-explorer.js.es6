import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "admin-plugins-explorer",

  model() {
    const groupPromise = this.store.findAll("group");
    const schemaPromise = ajax("/admin/plugins/explorer/schema.json", { cache: true });
    const queryPromise = this.store.findAll("query");

    return groupPromise
      .then(groups => {
        let groupNames = {};
        groups.forEach(g => {
          groupNames[g.id] = g.name;
        });
        return schemaPromise.then(schema => {
          return queryPromise.then(model => {
            model.forEach(query => {
              query.markNotDirty();
              query.set(
                "group_names",
                query.group_ids
                  .map(id => groupNames[id])
                  .filter(n => n)
                  .join(", ")
              );
            });
            return { model, schema, groups };
          });
        });
      })
      .catch(() => {
        schemaPromise.catch(() => {});
        queryPromise.catch(() => {});
        return { model: null, schema: null, disallow: true, groups: null };
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
