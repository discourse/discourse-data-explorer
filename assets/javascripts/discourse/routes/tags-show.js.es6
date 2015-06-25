export default Discourse.Route.extend({

  model(tag) {
    tag.tag_id = Handlebars.Utils.escapeExpression(tag.tag_id);

    if (this.get('currentUser')) {
      // If logged in, we should get the tag's user settings
      const self = this;
      return this.store.find('tagNotification', tag.tag_id).then(function(tn) {
        self.set('tagNotification', tn);
        return tag;
      });
    }

    return tag;
  },

  afterModel(tag) {
    const self = this;
    return Discourse.TopicList.list('tags/' + tag.tag_id).then(function(list) {
      self.set('list', list);
    });
  },

  setupController(controller, model) {
    controller.setProperties({
      tag: model,
      list: this.get('list'),
      tagNotification: this.get('tagNotification')
    });
  }
});
