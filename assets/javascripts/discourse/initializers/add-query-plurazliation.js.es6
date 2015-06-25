
export default {
  name: 'add-query-pluralization',
  initialize(container) {
    container.lookup('store:main').addPluralization('query', 'queries');
  }
};
