export default Discourse.Route.extend({
  model() {
    return Discourse.ajax("/tags/filter/cloud.json");
  }
});
