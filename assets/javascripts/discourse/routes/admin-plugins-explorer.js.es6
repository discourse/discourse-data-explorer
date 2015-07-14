
export default Discourse.Route.extend({
  controllerName: 'admin-plugins-explorer',
  queryParams: { id: { replace: true } },

  model() {
    const p1 = this.store.findAll('query');
    const p2 = Discourse.ajax('/admin/plugins/explorer/schema.json', {cache: true});
    return p1.then(function(model) {
      model.forEach(function(query) {
        query.markNotDirty();
      });
      return p2.then(function(schema) {
        return { content: model, schema: schema };
      });
    });
  },

  setupController: function(controller, model) {
    controller.set('model', model.content);
    controller.set('schema', model.schema);
  }
});
