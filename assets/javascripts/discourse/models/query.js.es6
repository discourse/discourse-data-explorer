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

  listName: function() {
    if (this.get('dirty')) {
      return this.get('name') + " (*)";
    }
    return this.get('name');
  }.property('name', 'dirty'),

  createProperties() {
    return this.getProperties("name");
  },

  updateProperties() {
    return this.getProperties(Query.updatePropertyNames);
  },

  run() {
    console.log("Called query#run");
  }
});

Query.reopenClass({
  updatePropertyNames: ["name", "description", "sql", "defaults"]
});

export default Query;
