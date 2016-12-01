import { observes } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({

  @observes('hideSchema')
  _onHideSchema() {
    this.appEvents.trigger('ace:resize');
  },

  @observes('everEditing')
  _onInsertEditor() {
    Ember.run.schedule('afterRender', this, () => this._bindControls());
  },

  _bindControls() {
    if (this._state !== "inDOM") {
      return;
    }
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
      //Em.Logger.debug("new height", newHeight);
      $targets.height(newHeight);
      self.appEvents.trigger('ace:resize');
    };

    let mouseup;
    mouseup = function(e) {
      mousemove(e);
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
  },

  didInsertElement() {
    this._super();
    this._bindControls();
  },

  willDestroyElement() {
    this._super();
    if (this.get('everEditing')) {
      this.get('grippie').off('mousedown');
      this.set('grippie', null);
    }
  }
});

