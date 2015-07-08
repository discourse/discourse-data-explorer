export default Ember.Component.extend({
  classNameBindings: [':schema-table', 'open'],

  open: Em.computed.alias('table.open'),

  _bindClicks: function() {
    const self = this;
    this.$()./*children('.schema-table-name').*/click(function() {
      self.set('open', !self.get('open'));
    });
  }.on('didInsertElement')
});
