import showModal from 'discourse/lib/show-modal';
import Query from 'discourse/plugins/discourse-data-explorer/discourse/models/query';

export default Ember.ArrayController.extend({
  selectedItem: null,
  dirty: false,
  loading: false,

  markDirty: function() {
    this.set('dirty', true);
  }.observes('selectedItem.name', 'selectedItem.description', 'selectedItem.sql'),

  actions: {
    selectItem(item) {
      this.setProperties({
        selectedItem: item,
        editName: false
      });
      this.set('dirty', false);
    },

    dummy() {},

    create() {
      const self = this;
      this.set('loading', true);
      var newQuery = this.store.createRecord('query', {name: this.get('newQueryName')});
      newQuery.save().then(function(result) {
        self.pushObject(result.target);
        self.set('selectedItem', result.target);
        self.set('dirty', false);
      }).finally(function() {
        self.set('loading', false);
      });
    },

    importQuery() {
      showModal('import-query');
    },

    editName() {
      this.setProperties({
        editName: true,
        dirty: true
      });
    },

    save() {
      const self = this;
      this.set('loading', true);
      this.get('selectedItem').save().then(function(result) {
        debugger;
      }).finally(function() {
        self.set('loading', false);
      });
    },

    discard() {
      const self = this;
      this.set('loading', true);
      this.store.find('query', this.selectedItem.id).then(function(result) {
        self.set('selectedItem', result);
      }).finally(function() {
        self.set('loading', false);
      });
    },

    run() {
      if (this.get('dirty')) {
        self.set('results', {errors: [I18n.t('errors.explorer.dirty')]});
        return;
      }
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
