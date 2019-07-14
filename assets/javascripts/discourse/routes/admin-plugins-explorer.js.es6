import { ajax } from "discourse/lib/ajax";

export default Discourse.Route.extend({
  controllerName: "admin-plugins-explorer",

  model() {
    const p1 = this.store.findAll("query");
    const p2 = ajax("/admin/plugins/explorer/schema.json", { cache: true });
    return p1
      .then(model => {
        model.forEach(query => query.markNotDirty());

        return p2.then(schema => {
          return { model, schema };
        });
      })
      .catch(() => {
        p2.catch(() => {});
        return { model: null, schema: null, disallow: true };
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
