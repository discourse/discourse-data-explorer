import RestModel from 'discourse/models/rest';

const Query = RestModel.extend({
  createProperties() {
    return this.getProperties("name");
  },

  updateProperties() {
    return this.getProperties("name", "description", "sql", "defaults");
  },

  run() {
    console.log("Called query#run");
  }
});

export default Query;
