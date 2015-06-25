import RestModel from 'discourse/models/rest';

const Query = RestModel.extend({
  createProperties() {
    return this.getProperties("name", "description");
  },

  run() {
    console.log("Called query#run");
  }
});

console.log('query model loaded');

export default Query;
