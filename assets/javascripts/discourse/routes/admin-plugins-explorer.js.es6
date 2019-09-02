import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "admin-plugins-explorer",

  model() {
    const p1 = this.store.findAll("group");
    const p2 = ajax("/admin/plugins/explorer/schema.json", { cache: true });
    const p3 = this.store.findAll("query");

    return p1
      .then(groups => {
        let group_names = {};
        groups.forEach(g => {
          group_names[g.id] = g.name;
        });
        return p2.then(schema => {
          return p3.then(model => {
            model.forEach(query => {
              query.markNotDirty();
              query.set(
                "group_names",
                query.group_ids
                  .map(id => group_names[id])
                  .filter(n => n)
                  .join(", ")
              );
            });
            return { model, schema, groups };
          });
        });
      })
      .catch(() => {
        p2.catch(() => {});
        p3.catch(() => {});
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
