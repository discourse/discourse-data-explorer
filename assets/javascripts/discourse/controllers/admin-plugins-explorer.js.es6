import showModal from 'discourse/lib/show-modal';
import Query from 'discourse/plugins/discourse-data-explorer/discourse/models/query';

export default Ember.ArrayController.extend({
  selectedQueryId: null,
  results: null,
  dirty: false,
  loading: false,

  explain: false,

  saveDisabled: Ember.computed.not('selectedItem.dirty'),
  runDisabled: Ember.computed.alias('selectedItem.dirty'),

  selectedItem: function() {
    const _id = this.get('selectedQueryId');
    const id = parseInt(_id);
    return this.get('content').find(function(q) {
      return q.get('id') === id;
    });
  }.property('selectedQueryId'),

  actions: {
    dummy() {},

    create() {
      const self = this;
      this.set('loading', true);
      this.set('showCreate', false);
      var newQuery = this.store.createRecord('query', {name: this.get('newQueryName')});
      newQuery.save().then(function(result) {
        self.pushObject(result.target);
        self.set('selectedQueryId', result.target.id);
        self.set('selectedItem.dirty', false);
        self.set('results', null);
      }).finally(function() {
        self.set('loading', false);
      });
    },

    importQuery() {
      showModal('import-query');
      this.set('showCreate', false);
    },

    showCreate() {
      this.set('showCreate', true);
    },

    editName() {
      this.set('editName', true);
    },

    save() {
      const self = this;
      this.set('loading', true);
      this.get('selectedItem').save().then(function() {
        const query = self.get('selectedItem');
        query.markNotDirty();
        self.set('editName', false);
      }).finally(function() {
        self.set('loading', false);
      });
    },

    discard() {
      const self = this;
      this.set('loading', true);
      this.store.find('query', this.get('selectedItem.id')).then(function(result) {
        const query = self.get('selectedItem');
        query.setProperties(result.getProperties(Query.updatePropertyNames));
        query.markNotDirty();
        self.set('editName', false);
        self.set('results', null);
      }).finally(function() {
        self.set('loading', false);
      });
    },

    run() {
      if (this.get('selectedItem.dirty')) {
        self.set('results', {errors: [I18n.t('errors.explorer.dirty')]});
        return;
      }
      const self = this;
      this.set('loading', true);
      Discourse.ajax("/admin/plugins/explorer/queries/" + this.get('selectedItem.id') + "/run", {
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
