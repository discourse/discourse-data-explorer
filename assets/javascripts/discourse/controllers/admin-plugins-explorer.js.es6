import showModal from 'discourse/lib/show-modal';

export default Ember.Controller.extend({
  selectedItem: null,

  actions: {
    selectItem(item) {
      this.set('selectedItem', item);
    },

    dummy() {},

    create() {
      var newQuery = this.store.createRecord('query', {name: this.get('newQueryName')});
      newQuery.save();
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
