import Component from "@glimmer/component";
import I18n from "I18n";
import Category from "discourse/models/category";
import { dasherize } from "@ember/string";
import { isEmpty } from "@ember/utils";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";

const layoutMap = {
  int: "int",
  bigint: "int",
  boolean: "boolean",
  string: "generic",
  time: "generic",
  date: "generic",
  datetime: "generic",
  double: "string",
  user_id: "user_id",
  post_id: "string",
  topic_id: "generic",
  category_id: "generic",
  group_id: "generic",
  badge_id: "generic",
  int_list: "generic",
  string_list: "generic",
  user_list: "user_list",
};

export default class ParamInput extends Component {
  @tracked value = this.args.info.identifier;
  @tracked valueBool = this.args.info.identifier !== "false";

  boolTypes = [
    { name: I18n.t("explorer.types.bool.true"), id: "Y" },
    { name: I18n.t("explorer.types.bool.false"), id: "N" },
    { name: I18n.t("explorer.types.bool.null_"), id: "#null" },
  ];

  get type() {
    const type = this.args.info.type;
    if ((type === "time" || type === "date") && !allowsInputTypeTime()) {
      return "string";
    }
    if (layoutMap[type]) {
      return layoutMap[type];
    }
    return "generic";
  }

  get valid() {
    const value = this.value;
    const type = this.args.info.type;
    const nullable = this.args.info.nullable;

    if (isEmpty(value)) {
      return nullable;
    }

    const intVal = parseInt(value, 10);
    const intValid =
      !isNaN(intVal) && intVal < 2147483648 && intVal > -2147483649;
    const isPositiveInt = /^\d+$/.test(value);
    switch (type) {
      case "int":
        return /^-?\d+$/.test(value) && intValid;
      case "bigint":
        return /^-?\d+$/.test(value) && !isNaN(intVal);
      case "boolean":
        return /^Y|N|#null|true|false/.test(value);
      case "double":
        return (
          !isNaN(parseFloat(value)) ||
          /^(-?)Inf(inity)?$/i.test(value) ||
          /^(-?)NaN$/i.test(value)
        );
      case "int_list":
        return value.split(",").every((i) => /^(-?\d+|null)$/.test(i.trim()));
      case "post_id":
        return isPositiveInt || /\d+\/\d+(\?u=.*)?$/.test(value);
      case "category_id":
        if (!isPositiveInt && value !== dasherize(value)) {
          this.set("value", dasherize(value));
        }

        if (isPositiveInt) {
          return !!this.site.categories.find((c) => c.id === intVal);
        } else if (/\//.test(value)) {
          const match = /(.*)\/(.*)/.exec(value);
          if (!match) {
            return false;
          }
          const result = Category.findBySlug(
            dasherize(match[2]),
            dasherize(match[1])
          );
          return !!result;
        } else {
          return !!Category.findBySlug(dasherize(value));
        }
      case "group_id":
        const groups = this.site.get("groups");
        if (isPositiveInt) {
          return !!groups.find((g) => g.id === intVal);
        } else {
          return !!groups.find((g) => g.name === value);
        }
    }
    return true;
  }

  constructor() {
    super(...arguments);

    if (
      this.args.initialValues &&
      this.args.info.identifier in this.args.initialValues
    ) {
      this.value = this.args.initialValues[this.args.info.identifier];
    }
  }

  @action
  updateValue(event) {
    this.value = event.target.value.toString();
  }

  @action
  updateValueBool(event) {
    this.value = !!event.target.value.toString();
  }
}

function allowsInputTypeTime() {
  try {
    const inp = document.createElement("input");
    inp.attributes.type = "time";
    inp.attributes.type = "date";
    return true;
  } catch (e) {
    return false;
  }
}
