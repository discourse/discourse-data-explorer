
export default Discourse.Route.extend({
  controllerName: 'admin-plugins-explorer',
  queryParams: { id: { replace: true } },

  model() {
    return this.store.findAll('query');
  }
});
