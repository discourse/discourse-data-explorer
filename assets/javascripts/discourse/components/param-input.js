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

  @tracked value;
  @tracked boolValue;
  @tracked nullableBoolValue;

  boolTypes = [
    { name: I18n.t("explorer.types.bool.true"), id: "Y" },
    { name: I18n.t("explorer.types.bool.false"), id: "N" },
    { name: I18n.t("explorer.types.bool.null_"), id: "#null" },
  ];

  constructor() {
    super(...arguments);

    const identifier = this.args.info.identifier;
    const initialValues = this.args.initialValues;

    // access parsed params if present to update values to previously ran values
    if (initialValues && identifier in initialValues) {
      const initialValue = initialValues[identifier];
      if (this.type === "boolean") {
        if (this.args.info.nullable) {
          this.nullableBoolValue = initialValue;
          this.args.updateParams(
            this.args.info.identifier,
            this.nullableBoolValue
          );
        } else {
          this.boolValue = initialValue !== "false";
          this.args.updateParams(this.args.info.identifier, this.boolValue);
        }
      } else {
        this.value =
          this.args.info.type === "category_id"
            ? this.dasherizeCategoryId(initialValue)
            : initialValue;
        this.args.updateParams(this.args.info.identifier, this.value);
      }
    } else {
      // if no parsed params then get and set default values
      const defaultValue = this.args.info.default;
      this.value =
        this.args.info.type === "category_id"
          ? this.dasherizeCategoryId(defaultValue)
          : defaultValue;
      this.boolValue = defaultValue !== "false";
      this.nullableBoolValue = defaultValue;
    }
  }

  get type() {
    const type = this.args.info.type;
    if ((type === "time" || type === "date") && !allowsInputTypeTime()) {
      return "string";
    }
    return layoutMap[type] || "generic";
  }

  get valid() {
    const nullable = this.args.info.nullable;
    // intentionally use 'this.args' here instead of 'this.type'
    // to get the original key instead of the translated value from the layoutMap
    const type = this.args.info.type;
    let value;

    if (type === "boolean") {
      value = nullable ? this.nullableBoolValue : this.boolValue;
    } else {
      value = this.value;
    }

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

  dasherizeCategoryId(value) {
    const isPositiveInt = /^\d+$/.test(value);
    if (!isPositiveInt && value !== dasherize(value)) {
      return dasherize(value);
    }
    return value;
  }

  @action
  updateValue(input) {
    // handle selectKit inputs as well as traditional inputs
    const value = input.target ? input.target.value : input;
    if (value.length) {
      this.value =
        this.args.info.type === "category_id"
          ? this.dasherizeCategoryId(value.toString())
          : value.toString();
    } else {
      this.value = value;
    }

    this.args.updateParams(this.args.info.identifier, this.value);
  }

  @action
  updateBoolValue(input) {
    this.boolValue = input.target.checked;
    this.args.updateParams(
      this.args.info.identifier,
      this.boolValue.toString()
    );
  }

  @action
  updateNullableBoolValue(input) {
    this.nullableBoolValue = input;
    this.args.updateParams(this.args.info.identifier, this.nullableBoolValue);
  }
}

function allowsInputTypeTime() {
  try {
    const input = document.createElement("input");
    input.attributes.type = "time";
    input.attributes.type = "date";
    return true;
  } catch (e) {
    return false;
  }
}
