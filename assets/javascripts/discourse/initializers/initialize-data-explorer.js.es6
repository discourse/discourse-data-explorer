export default {
  name: "initialize-data-explorer",
  initialize(container) {
    container.lookup("store:main").addPluralization("query", "queries");

    if (!String.prototype.endsWith) {
      // eslint-disable-next-line no-extend-native
      String.prototype.endsWith = function(searchString, position) {
        const subjectString = this.toString();
        if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
        }
        position -= searchString.length;
        const lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
      };
    }
  }
};
