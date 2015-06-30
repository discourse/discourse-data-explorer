import RestModel from 'discourse/models/rest';

let Query;
Query = RestModel.extend({
  dirty: false,

  markDirty: function() {
    this.set('dirty', true);
  }.observes('name', 'description', 'sql', 'defaults'),

  markNotDirty() {
    this.set('dirty', false);
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
  updatePropertyNames: ["name", "description", "sql", "defaults"]
});

export default Query;
