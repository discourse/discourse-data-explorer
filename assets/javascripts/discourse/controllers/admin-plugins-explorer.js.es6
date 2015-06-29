import showModal from 'discourse/lib/show-modal';
import Query from 'discourse/plugins/discourse-data-explorer/discourse/models/query';

export default Ember.ArrayController.extend({
  selectedItem: null,

  actions: {
    selectItem(item) {
      this.set('selectedItem', item);
    },

    dummy() {},

    create() {
      const self = this;
      var newQuery = this.store.createRecord('query', {name: this.get('newQueryName')});
      newQuery.save().then(function(result) {
        self.pushObject(result.target);
        self.set('selectedItem', result.target);
        debugger;
      });
    },

    importQuery() {
      showModal('import-query');
    },

    run() {
      const self = this;
      this.set('loading', true);
      Discourse.ajax("/admin/plugins/explorer/query/" + this.get('selectedItem.id') + "/run", {
        type: "POST",
        data: {
          params: JSON.stringify({foo: 34}),
          explain: true
        }
      }).then(function(result) {
        console.log(result);
        self.set('results', result);
      }).finally(function() {
        self.set('loading', false);
      });
    }
  }
});
