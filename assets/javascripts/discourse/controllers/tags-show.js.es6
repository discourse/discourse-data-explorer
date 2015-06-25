export default Ember.Controller.extend({
  tag: null,
  list: null,

  loadMoreTopics() {
    return this.get('list').loadMore();
  },

  actions: {
    changeTagNotification(id) {
      const tagNotification = this.get('tagNotification');
      tagNotification.update({ notification_level: id });
    }
  }
});
