import showModal from 'discourse/lib/show-modal';
import Query from 'discourse/plugins/discourse-data-explorer/discourse/models/query';
import { popupAjaxError } from 'discourse/lib/ajax-error';
import { ajax } from 'discourse/lib/ajax';

const NoQuery = Query.create({name: "No queries", fake: true});

export default Ember.Controller.extend({
  queryParams: { selectedQueryId: "id" },
  selectedQueryId: null,
  showResults: false,
  hideSchema: false,
  loading: false,

  explain: false,

  saveDisabled: Ember.computed.not('selectedItem.dirty'),
  runDisabled: Ember.computed.alias('selectedItem.dirty'),
  results: Em.computed.alias('selectedItem.results'),

  editing: false,
  everEditing: false,
  showRecentQueries: true,

  createDisabled: function() {
    return (this.get('newQueryName') || "").trim().length === 0;
  }.property('newQueryName'),

  selectedItem: function() {
    const id = parseInt(this.get('selectedQueryId'));
    const item = this.get('content').find(q => q.get('id') === id);
    if (!isNaN(id)) {
      this.set('showRecentQueries', false);
    }
    return item || NoQuery;
  }.property('selectedQueryId'),

  othersDirty: function() {
    const selected = this.get('selectedItem');
    return !!this.get('content').find(q => q !== selected && q.get('dirty'));
  }.property('selectedItem', 'selectedItem.dirty'),

  setEverEditing: function() {
    if (this.get('editing') && !this.get('everEditing')) {
      this.set('everEditing', true);
    }
  }.observes('editing'),

  addCreatedRecord(record) {
    this.get('model').pushObject(record);
    this.set('selectedQueryId', Ember.get(record, 'id'));
    this.get('selectedItem').set('dirty', false);
    this.set('showResults', false);
    this.set('results', null);
    this.set('editing', true);
  },

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
      this.set('showRecentQueries', false);
    },

    showRecentQueries() {
      this.set('showRecentQueries', true);
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
      const name = this.get("newQueryName").trim();
      this.set('loading', true);
      this.set('showCreate', false);
      this.set('showRecentQueries', false);
      this.store
        .createRecord('query', { name })
        .save()
        .then(result => this.addCreatedRecord(result.target) )
        .catch(popupAjaxError)
        .finally(() => this.set('loading', false));
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
      ajax("/admin/plugins/explorer/queries/" + this.get('selectedItem.id') + "/run", {
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
      }).catch(function(err) {
        self.set('showResults', false);
        if (err.jqXHR && err.jqXHR.status === 422 && err.jqXHR.responseJSON) {
          self.set('results', err.jqXHR.responseJSON);
        } else {
          popupAjaxError(err);
        }
      }).finally(function() {
        self.set('loading', false);
      });
    }
  }
});
