export default {
  name: "initialize-data-explorer",
  initialize(container) {
    container.lookup("store:main").addPluralization("query", "queries");
  },
};
