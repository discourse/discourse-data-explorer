import RestModel from 'discourse/models/rest';

let Query;
Query = RestModel.extend({
  dirty: false,
  params: {},

  _init: function() {
    this._super();
    if (!this.get('options')) {
      this.set('options', {defaults:{}});
    }
    this.set('dirty', false);
  }.on('init'),

  _initParams: function() {
    this.resetParams();
  }.on('init').observes('param_names'),

  options: Em.computed.alias('qopts'),

  markDirty: function() {
    this.set('dirty', true);
  }.observes('name', 'description', 'sql', 'options', 'options.defaults'),

  markNotDirty() {
    this.set('dirty', false);
  },

  resetParams() {
    let newParams = {};
    let defaults = this.get('options.defaults');
    if (!defaults) {
      defaults = {};
    }
    (this.get('param_names') || []).forEach(function(name) {
      if (defaults[name]) {
        newParams[name] = defaults[name];
      } else {
        newParams[name] = '';
      }
    });
    this.set('params', newParams);
  },

  saveDefaults() {
    const currentParams = this.get('params');
    let defaults = {};
    (this.get('param_names') || []).forEach(function(name) {
      if (currentParams[name]) {
        defaults[name] = currentParams[name];
      } else {
        delete defaults[name];
      }
    });
    this.set('options.defaults', defaults);
  },

  downloadUrl: function() {
    // TODO - can we change this to use the store/adapter?
    return Discourse.getURL("/admin/plugins/explorer/queries/" + this.get('id') + ".json?export=1");
  }.property('id'),

  listName: function() {
    let name = this.get('name');
    if (this.get('dirty')) {
      name += " (*)";
    }
    if (this.get('destroyed')) {
      name += " (deleted)";
    }
    return name;
  }.property('name', 'dirty', 'destroyed'),

  createProperties() {
    if (this.get('sql')) {
      // Importing
      return this.updateProperties();
    }
    return this.getProperties("name");
  },

  updateProperties() {
    let props = this.getProperties(Query.updatePropertyNames);
    if (this.get('destroyed')) {
      props.id = this.get('id');
    }
    return props;
  },

  run() {
    console.log("Called query#run");
  }
});

Query.reopenClass({
  updatePropertyNames: ["name", "description", "sql", "qopts"]
});

export default Query;
