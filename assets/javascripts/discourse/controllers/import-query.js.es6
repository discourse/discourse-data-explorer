import ModalFunctionality from 'discourse/mixins/modal-functionality';
import { popupAjaxError } from 'discourse/lib/ajax-error';

export default Ember.Controller.extend(ModalFunctionality, {
  notReady: Em.computed.not('ready'),

  needs: ['admin-plugins-explorer'],

  ready: function() {
    let parsed;
    try {
      parsed = JSON.parse(this.get('queryFile'));
    } catch (e) {
      return false;
    }

    return !!parsed["query"];
  }.property('queryFile'),

  actions: {
    doImport: function() {
      const self = this;
      const object = JSON.parse(this.get('queryFile')).query;

      // Slight fixup before creating object
      object.id = 0; // 0 means no Id yet

      this.set('loading', true);
      this.store.createRecord('query', object).save().then(function(query) {
        self.send('closeModal');
        self.set('loading', false);

        const parentController = self.get('controllers.admin-plugins-explorer');
        parentController.addCreatedRecord(query.target);
      }).catch(popupAjaxError);
    }
  }

});
