import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  tagName: "ol",

  @discourseComputed("col.enum")
  enuminfo(hash) {
    let result = [];
    for (let key in hash) {
      if (!hash.hasOwnProperty(key)) {
        continue;
      }
      result.push({ value: key, name: hash[key] });
    }
    return result;
  },
});
