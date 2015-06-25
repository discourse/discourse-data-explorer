

export default Discourse.Route.extend({
  controllerName: 'admin-plugins-explorer',

  model() {
    return this.store.findAll('query');
  }
});
