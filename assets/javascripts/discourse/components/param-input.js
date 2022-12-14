import Component from "@glimmer/component";
import I18n from "I18n";
import Category from "discourse/models/category";
import { dasherize } from "@ember/string";
import { isEmpty } from "@ember/utils";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";

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
  @service site;

  @tracked value = this.args.params[this.args.info.identifier];
  @tracked valueBool = this.args.params[this.args.info.identifier] !== "false";

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
          //this.value = dasherize(value);
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

    //setup default values
    if (
      this.args.initialValues &&
      this.args.info.identifier in this.args.initialValues
    ) {
      const initialValue = this.args.initialValues[this.args.info.identifier];

      if (this.type === "boolean") {
        this.valueBool = initialValue !== "false";
      }
      this.value = initialValue;
    }

    // and update the parent to have any previously saved (new default) values picked up in url
    this.args.updateParams(
      this.args.info.identifier,
      this.type === "boolean" ? this.valueBool.toString() : this.value
    );
  }

  @action
  updateValue(input) {
    // handle selectKit inputs as well as traditional inputs
    const value = input.target ? input.target.value : input;
    this.value = value.length ? value.toString() : value;
    this.args.updateParams(this.args.info.identifier, this.value);
  }

  @action
  updateValueBool(input) {
    this.valueBool = input.target.checked;
    this.args.updateParams(
      this.args.info.identifier,
      this.valueBool.toString()
    );
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
