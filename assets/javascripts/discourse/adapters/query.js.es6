import buildPluginAdapter from 'discourse/adapters/build-plugin';

export default buildPluginAdapter('explorer').extend({

  createRecord(store, type, args) {
    const typeField = Ember.String.underscore(type);
    return Discourse.ajax(this.pathFor(store, type), {method: 'POST', data: args}).then(function (json) {
      return new Result(json[typeField], json);
    });
  }
});
