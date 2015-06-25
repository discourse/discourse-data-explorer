import showModal from 'discourse/lib/show-modal';

export default Discourse.Route.extend({
  controllerName: 'admin-plugins-explorer',

  model() {
    return this.store.findAll('query');
  },

  setupController(controller, model) {

  },

  actions: {
    create() {

    },
    importQuery() {
      showModal('import-query');
    }
  }
});
