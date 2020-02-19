import { default as computed } from "discourse-common/utils/decorators";

export default Ember.Component.extend({
  tagName: "ol",

  @computed("col.enum")
  enuminfo(hash) {
    let result = [];
    for (let key in hash) {
      if (!hash.hasOwnProperty(key)) {
        continue;
      }
      result.push({ value: key, name: hash[key] });
    }
    return result;
  }
});
