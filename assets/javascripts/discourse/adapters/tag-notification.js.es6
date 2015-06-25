import RESTAdapter from 'discourse/adapters/rest';

export default RESTAdapter.extend({
  pathFor(type, id) {
    return "/tags/" + id + "/notifications";
  }
});
