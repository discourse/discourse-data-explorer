export default Ember.TextField.extend({
  value: function(key, value, previousValue) {
    if (arguments.length > 1) {
      this.get('params')[this.get('pname')] = value;
    }
    return this.get('params')[this.get('pname')];
  }.property('params', 'pname')
});
