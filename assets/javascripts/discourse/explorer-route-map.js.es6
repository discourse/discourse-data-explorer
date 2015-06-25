export default {
  resource: 'admin.adminPlugins',
  path: '/plugins',
  map() {
    this.route('explorer');
    this.route('explorer-show', {path: 'explorer/:id'});
  }
};
