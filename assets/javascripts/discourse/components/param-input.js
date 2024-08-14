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
  bigint: "string",
  boolean: "boolean",
  string: "string",
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

const ERRORS = {
  REQUIRED: I18n.t("form_kit.errors.required"),
  NOT_AN_INTEGER: I18n.t("form_kit.errors.not_an_integer"),
  NOT_A_NUMBER: I18n.t("form_kit.errors.not_a_number"),
  OVERFLOW_HIGH: I18n.t("form_kit.errors.too_high", { count: 2147484647 }),
  OVERFLOW_LOW: I18n.t("form_kit.errors.too_low", { count: -2147484648 }),
  INVALID: I18n.t("explorer.form.errors.invalid"),
  NO_SUCH_CATEGORY: I18n.t("explorer.form.errors.no_such_category"),
  NO_SUCH_GROUP: I18n.t("explorer.form.errors.no_such_group"),
};

export default class ParamInput extends Component {
  @service site;

  /**
   * @type {string | string[] | boolean | null}
   */
  @tracked value;

  boolTypes = [
    { name: I18n.t("explorer.types.bool.true"), id: "Y" },
    { name: I18n.t("explorer.types.bool.false"), id: "N" },
    { name: I18n.t("explorer.types.bool.null_"), id: "#null" },
  ];

  constructor() {
    super(...arguments);

    const identifier = this.args.info.identifier;
    const initialValues = this.args.initialValues;

    // defet it to next tick to prevent infinite looping.
    setTimeout(() => {
      // access parsed params if present to update values to previously ran values
      if (initialValues && identifier in initialValues) {
        const initialValue = initialValues[identifier];
        this.value = this.normalizeValue(initialValue);
        this.args.updateParams(this.args.info.identifier, this.provideValue);
        this.form.set(identifier, this.value);
      } else {
        // if no parsed params then get and set default values
        const defaultValue = this.args.info.default;
        this.value = this.normalizeValue(defaultValue);
        if (this.value != null) {
          this.args.updateParams(this.args.info.identifier, this.provideValue);
          this.form.set(identifier, this.value);
        }
      }
    }, 0);
  }

  /** The value we will store in this.value */
  normalizeValue(value) {
    switch (this.args.info.type) {
      case "category_id":
        return this.digitalizeCategoryId(value);
      case "boolean":
        if (value == null) {
          return this.args.info.nullable ? "#null" : false;
        }
        return value;
      case "group_list":
      case "user_list":
        if (Array.isArray(value)) {
          return value || null;
        }
        return value?.split(",") || null;
      case "user_id":
        if (Array.isArray(value)) {
          return value[0];
        }
        return value;
      default:
        return value;
    }
  }

  /** The value we submitted when updatingParams */
  get provideValue() {
    switch (this.type) {
      case "string":
      case "int":
        return this.value != null ? String(this.value) : "";
      case "boolean":
        return String(this.value);
      case "group_list":
      case "user_list":
        return this.value.join(",");
      default:
        return this.value;
    }
  }

  get form() {
    return this.args.form;
  }

  get type() {
    const type = this.args.info.type;
    if ((type === "time" || type === "date") && !allowsInputTypeTime()) {
      return "string";
    }
    return layoutMap[type] || "generic";
  }

  /** @returns {null | string} */
  getError() {
    const nullable = this.args.info.nullable;
    if (isEmpty(this.value)) {
      return nullable ? null : ERRORS.REQUIRED;
    }

    // intentionally use 'this.args' here instead of 'this.type'
    // to get the original key instead of the translated value from the layoutMap
    const type = this.args.info.type;
    const value = String(this.value);

    const intVal = parseInt(value, 10);
    const isPositiveInt = /^\d+$/.test(value);
    switch (type) {
      case "int":
        if (intVal >= 2147483648) {
          return ERRORS.OVERFLOW_HIGH;
        }
        if (intVal <= -2147483649) {
          return ERRORS.OVERFLOW_LOW;
        }
        return null;
      case "bigint":
        if (isNaN(intVal)) {
          return ERRORS.NOT_A_NUMBER;
        }
        return /^-?\d+$/.test(value) ? null : ERRORS.NOT_AN_INTEGER;
      case "boolean":
        return /^Y|N|#null|true|false/.test(value) ? null : ERRORS.INVALID;
      case "double":
        if (isNaN(parseFloat(value))) {
          if (/^(-?)Inf(inity)?$/i.test(value) || /^(-?)NaN$/i.test(value)) {
            return null;
          }
          return ERRORS.NOT_A_NUMBER;
        }
        return null;
      case "int_list":
        return value.split(",").every((i) => /^(-?\d+|null)$/.test(i.trim()))
          ? null
          : ERRORS.INVALID;
      case "post_id":
        return isPositiveInt ||
          /\d+\/\d+(\?u=.*)?$/.test(value) ||
          /\/t\/[^/]+\/(\d+)(\?u=.*)?/.test(value)
          ? null
          : ERRORS.INVALID;
      case "topic_id":
        return isPositiveInt || /\/t\/[^/]+\/(\d+)/.test(value)
          ? null
          : ERRORS.INVALID;
      case "category_id":
        if (isPositiveInt) {
          return this.site.categories.find((c) => c.id === intVal)
            ? null
            : ERRORS.NO_SUCH_CATEGORY;
        } else {
          return ERRORS.REQUIRED;
        }
      case "group_id":
        const groups = this.site.get("groups");
        if (isPositiveInt) {
          return groups.find((g) => g.id === intVal)
            ? null
            : ERRORS.NO_SUCH_GROUP;
        } else {
          return groups.find((g) => g.name === value)
            ? null
            : ERRORS.NO_SUCH_GROUP;
        }
    }
    return null;
  }

  get valid() {
    return this.getError() == null;
  }

  get allGroups() {
    return this.site.get("groups");
  }

  get validation() {
    if (this.type === "boolean") {
      return "";
    }
    return this.args.info.nullable ? "" : "required";
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
  validate(name, value, { addError }) {
    const message = this.getError();
    if (message != null) {
      // skip require validation for we have used them in @validation
      if (message === ERRORS.REQUIRED) {
        return;
      }
      addError(name, {
        title: this.args.info.identifier,
        message,
      });
    }
  }

  @action
  updateValue(input) {
    // handle selectKit inputs as well as traditional inputs
    const value = input?.target ? input.target.value : input;
    this.value = this.normalizeValue(value);
    this.args.updateParams(this.args.info.identifier, this.provideValue);
    this.form.set(this.args.info.identifier, value);
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
