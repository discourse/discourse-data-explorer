import RestModel from 'discourse/models/rest';

const Query = RestModel.extend({
  dirty: false,
  params: {},
  results: null,

  _init: function() {
    this._super();
    this.set('dirty', false);
  }.on('init'),

  _initParams: function() {
    this.resetParams();
  }.on('init').observes('param_info'),

  markDirty: function() {
    this.set('dirty', true);
  }.observes('name', 'description', 'sql'),

  markNotDirty() {
    this.set('dirty', false);
  },

  hasParams: function() {
    return this.get('param_info.length') > 0;
  }.property('param_info'),

  resetParams() {
    const newParams = {};
    const oldParams = this.get('params');
    const paramInfo = this.get('param_info') || [];
    paramInfo.forEach(function(pinfo) {
      const name = pinfo.identifier;
      if (oldParams[pinfo.identifier]) {
        newParams[name] = oldParams[name];
      } else if (pinfo['default'] !== null) {
        newParams[name] = pinfo['default'];
      } else {
        newParams[name] = '';
      }
    });
    this.set('params', newParams);
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
  }
});

Query.reopenClass({
  updatePropertyNames: ["name", "description", "sql"]
});

export default Query;
