
export default Ember.View.extend({
  _bindGrippie: function() {
    const $editPane = this.$().find('.query-editor');
    if (!$editPane.length) {
      return;
    }
    const oldGrippie = this.get('grippie');
    if (oldGrippie) {
      oldGrippie.off('mousedown mousemove mouseup');
      $editPane.off('mousemove mouseup');
    }

    const $grippie = $editPane.find('.grippie');
    const $targets = $editPane.find('.ace-wrapper,.grippie-target');
    const $body = $('body');
    const self = this;

    this.set('grippie', $grippie);

    const mousemove = function(e) {
      const diff = self.get('startY') - e.screenY;
      const newHeight = self.get('startSize') - diff;
      Em.Logger.debug("new height", newHeight);
      $targets.height(newHeight);
      self.appEvents.trigger('ace:resize');
    };

    let mouseup;
    mouseup = function(e) {
      mousemove(e);
      Em.Logger.debug("mouseup");
      $body.off('mousemove', mousemove);
      $body.off('mouseup', mouseup);
      self.set('startY', null);
      self.set('startSize', null);
    };

    $grippie.on('mousedown', function(e) {
      self.set('startY', e.screenY);
      self.set('startSize', $targets.height());

      $body.on('mousemove', mousemove);
      $body.on('mouseup', mouseup);
      e.preventDefault();
    });

  }.on('didInsertElement'),

  _cleanup: function() {
    this.get('grippie').off('mousedown');
    this.set('grippie', null);
  }.on('willDestroyElement')
});
