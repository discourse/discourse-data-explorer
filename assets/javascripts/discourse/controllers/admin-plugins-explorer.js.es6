import showModal from 'discourse/lib/show-modal';
import Query from 'discourse/plugins/discourse-data-explorer/discourse/models/query';
import { popupAjaxError } from 'discourse/lib/ajax-error';

const NoQuery = Query.create({name: "No queries", fake: true});

export default Ember.ArrayController.extend({
  queryParams: { selectedQueryId: "id" },
  selectedQueryId: null,
  showResults: false,
  loading: false,

  explain: false,

  saveDisabled: Ember.computed.not('selectedItem.dirty'),
  runDisabled: Ember.computed.alias('selectedItem.dirty'),

  selectedItem: function() {
    const _id = this.get('selectedQueryId');
    const id = parseInt(_id);
    const item = this.get('content').find(function(q) {
      return q.get('id') === id;
    });
    return item || NoQuery;
  }.property('selectedQueryId'),

  results: Em.computed.alias('selectedItem.results'),

  addCreatedRecord(record) {
    this.pushObject(record);
    this.set('selectedQueryId', Ember.get(record, 'id'));
    this.get('selectedItem').set('dirty', false);
    this.set('showResults', false);
    this.set('results', null);
  },

  not_https: function() {
    return !(
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname.endsWith(".local")
    );
  }.property(),

  save() {
    const self = this;
    this.set('loading', true);
    return this.get('selectedItem').save().then(function() {
      const query = self.get('selectedItem');
      query.markNotDirty();
      self.set('editing', false);
    }).catch(function(x) {
      popupAjaxError(x);
      throw x;
    }).finally(function() {
      self.set('loading', false);
    });
  },

  actions: {
    dummy() {},

    importQuery() {
      showModal('import-query');
      this.set('showCreate', false);
    },

    showCreate() {
      this.set('showCreate', true);
    },

    editName() {
      this.set('editing', true);
    },

    download() {
      window.open(this.get('selectedItem.downloadUrl'), "_blank");
    },

    resetParams() {
      this.get('selectedItem').resetParams();
    },

    saveDefaults() {
      this.get('selectedItem').saveDefaults();
    },

    save() {
      this.save();
    },

    saverun() {
      this.save().then(() => this.send('run'));
    },

    create() {
      const self = this;
      this.set('loading', true);
      this.set('showCreate', false);
      var newQuery = this.store.createRecord('query', {name: this.get('newQueryName')});
      newQuery.save().then(function(result) {
        self.addCreatedRecord(result.target);
      }).catch(popupAjaxError).finally(function() {
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
        self.set('editing', false);
      }).catch(popupAjaxError).finally(function() {
        self.set('loading', false);
      });
    },

    destroy() {
      const self = this;
      const query = this.get('selectedItem');
      this.set('loading', true);
      this.store.destroyRecord('query', query).then(function() {
        query.set('destroyed', true);
      }).catch(popupAjaxError).finally(function() {
        self.set('loading', false);
      });
    },

    recover() {
      const self = this;
      const query = this.get('selectedItem');
      this.set('loading', true);
      query.save().then(function() {
        query.set('destroyed', false);
      }).catch(popupAjaxError).finally(function() {
        self.set('loading', false);
      });
    },

    run() {
      const self = this;
      if (this.get('selectedItem.dirty')) {
        return;
      }
      if (this.get('runDisabled')) {
        return;
      }

      this.set('loading', true);
      this.set('showResults', false);
      Discourse.ajax("/admin/plugins/explorer/queries/" + this.get('selectedItem.id') + "/run", {
        type: "POST",
        data: {
          params: JSON.stringify(this.get('selectedItem.params')),
          explain: this.get('explain')
        }
      }).then(function(result) {
        self.set('results', result);
        if (!result.success) {
          self.set('showResults', false);
          return;
        }

        self.set('showResults', true);
      }).catch(function(result) {
        self.set('showResults', false);
        self.set('results', result);
      }).finally(function() {
        self.set('loading', false);
      });
    }
  }
});
