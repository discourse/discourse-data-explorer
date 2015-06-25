
export default Discourse.Route.extend({
  model(params) {
    return this.store.find('query', params.get('id'));
  }
});
