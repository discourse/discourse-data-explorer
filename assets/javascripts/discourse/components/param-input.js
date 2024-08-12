import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { dasherize } from "@ember/string";
import { isEmpty } from "@ember/utils";
import Category from "discourse/models/category";
import I18n from "I18n";

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
  category_id: "category_id",
  group_id: "generic",
  badge_id: "generic",
  int_list: "generic",
  string_list: "generic",
  user_list: "user_list",
  group_list: "group_list",
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

    console.log(this.args);

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
        this.value = this.normalizeValue(initialValue);
        this.args.updateParams(this.args.info.identifier, this.value);
      }
    } else {
      // if no parsed params then get and set default values
      const defaultValue = this.args.info.default;
      this.value = this.normalizeValue(defaultValue);
      this.boolValue = defaultValue !== "false";
      this.nullableBoolValue = defaultValue;
    }
  }

  normalizeValue(value) {
    switch (this.args.info.type) {
      case "category_id":
        return this.digitalizeCategoryId(value);
      default:
        return value;
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
        return (
          isPositiveInt ||
          /\d+\/\d+(\?u=.*)?$/.test(value) ||
          /\/t\/[^/]+\/(\d+)(\?u=.*)?/.test(value)
        );
      case "topic_id":
        return isPositiveInt || /\/t\/[^/]+\/(\d+)/.test(value);
      case "category_id":
        if (isPositiveInt) {
          return !!this.site.categories.find((c) => c.id === intVal);
        } else {
          return false;
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

  get allGroups() {
    return this.site.get("groups");
  }

  digitalizeCategoryId(value) {
    value = String(value || "");
    const isPositiveInt = /^\d+$/.test(value);
    if (!isPositiveInt) {
      if (/\//.test(value)) {
        const match = /(.*)\/(.*)/.exec(value);
        if (!match) {
          value = null;
        } else {
          value = Category.findBySlug(
            dasherize(match[2]),
            dasherize(match[1])
          )?.id;
        }
      } else {
        value = Category.findBySlug(dasherize(value))?.id;
      }
    }
    return value?.toString();
  }

  @action
  updateValue(input) {
    // handle selectKit inputs as well as traditional inputs
    const value = input.target ? input.target.value : input;
    if (value.length) {
      this.value = this.normalizeValue(value.toString());
    } else {
      this.value = this.normalizeValue(value);
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

  @action
  updateGroupValue(input) {
    this.value = input;
    this.args.updateParams(this.args.info.identifier, this.value.join(","));
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
