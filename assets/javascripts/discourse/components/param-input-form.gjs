import Component from "@glimmer/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { dasherize } from "@ember/string";
import { isEmpty } from "@ember/utils";
import Form from "discourse/components/form";
import Category from "discourse/models/category";
import I18n from "I18n";
import BooleanThree from "./param-input/boolean-three";
import CategoryIdInput from "./param-input/category-id-input";
import GroupListInput from "./param-input/group-list-input";
import UserIdInput from "./param-input/user-id-input";
import UserListInput from "./param-input/user-list-input";

export class ParamValidationError extends Error {}

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

function digitalizeCategoryId(value) {
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

function normalizeValue(info, value) {
  switch (info.type) {
    case "category_id":
      return digitalizeCategoryId(value);
    case "boolean":
      if (value == null) {
        return info.nullable ? "#null" : false;
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

function serializeValue(type, value) {
  switch (type) {
    case "string":
    case "int":
      return value != null ? String(value) : "";
    case "boolean":
      return String(value);
    case "group_list":
    case "user_list":
      return value?.join(",");
    default:
      return value?.toString();
  }
}

function validationOf(info) {
  switch (layoutMap[info.type]) {
    case "boolean":
      return info.nullable ? "required" : "";
    case "string":
    case "string_list":
    case "generic":
      return info.nullable ? "" : "required:trim";
    default:
      return info.nullable ? "" : "required";
  }
}

function componentOf(info) {
  let type = layoutMap[info.type] || "generic";
  if (info.nullable && type === "boolean") {
    type = "boolean_three";
  }
  switch (type) {
    case "int":
      return <template>
        <@field.Input @type="number" name={{@info.identifier}} />
      </template>;
    case "boolean":
      return <template><@field.Checkbox name={{@info.identifier}} /></template>;
    case "boolean_three":
      return BooleanThree;
    case "category_id":
      // TODO
      return CategoryIdInput;
    case "user_id":
      return UserIdInput;
    case "user_list":
      return UserListInput;
    case "group_list":
      return GroupListInput;

    case "bigint":
    case "string":
    default:
      return <template><@field.Input name={{@info.identifier}} /></template>;
  }
}

export default class ParamInputForm extends Component {
  @service site;
  data = {};
  paramInfo = [];
  infoOf = {};
  form = null;

  constructor() {
    super(...arguments);

    const initialValues = this.args.initialValues;
    for (const info of this.args.paramInfo) {
      const identifier = info.identifier;

      // access parsed params if present to update values to previously ran values
      let initialValue;
      if (initialValues && identifier in initialValues) {
        initialValue = initialValues[identifier];
      } else {
        // if no parsed params then get and set default values
        initialValue = info.default;
      }
      this.data[identifier] = normalizeValue(info, initialValue);
      this.paramInfo.push({
        ...info,
        validation: validationOf(info),
        validate: this.validatorOf(info),
        component: componentOf(info),
      });
      this.infoOf[identifier] = info;
    }

    this.args.onRegisterApi?.({
      submit: this.submit,
    });
  }

  getErrorFn(info) {
    const isPositiveInt = (value) => /^\d+$/.test(value);
    const VALIDATORS = {
      int: (value) => {
        if (value >= 2147483648) {
          return ERRORS.OVERFLOW_HIGH;
        }
        if (value <= -2147483649) {
          return ERRORS.OVERFLOW_LOW;
        }
        return null;
      },
      bigint: (value) => {
        if (isNaN(parseInt(value, 10))) {
          return ERRORS.NOT_A_NUMBER;
        }
        return /^-?\d+$/.test(value) ? null : ERRORS.NOT_AN_INTEGER;
      },
      boolean: (value) => {
        return /^Y|N|#null|true|false/.test(String(value))
          ? null
          : ERRORS.INVALID;
      },
      double: (value) => {
        if (isNaN(parseFloat(value))) {
          if (/^(-?)Inf(inity)?$/i.test(value) || /^(-?)NaN$/i.test(value)) {
            return null;
          }
          return ERRORS.NOT_A_NUMBER;
        }
        return null;
      },
      int_list: (value) => {
        return value.split(",").every((i) => /^(-?\d+|null)$/.test(i.trim()))
          ? null
          : ERRORS.INVALID;
      },
      post_id: (value) => {
        return isPositiveInt(value) ||
          /\d+\/\d+(\?u=.*)?$/.test(value) ||
          /\/t\/[^/]+\/(\d+)(\?u=.*)?/.test(value)
          ? null
          : ERRORS.INVALID;
      },
      topic_id: (value) => {
        return isPositiveInt(value) || /\/t\/[^/]+\/(\d+)/.test(value)
          ? null
          : ERRORS.INVALID;
      },
      category_id: (value) => {
        return this.site.categoriesById.get(Number(value))
          ? null
          : ERRORS.NO_SUCH_CATEGORY;
      },
      group_id: (value) => {
        const groups = this.site.get("groups");
        if (isPositiveInt(value)) {
          const intVal = parseInt(value, 10);
          return groups.find((g) => g.id === intVal)
            ? null
            : ERRORS.NO_SUCH_GROUP;
        } else {
          return groups.find((g) => g.name === value)
            ? null
            : ERRORS.NO_SUCH_GROUP;
        }
      },
    };
    return VALIDATORS[info.type] ?? (() => null);
  }

  validatorOf(info) {
    const getError = this.getErrorFn(info);
    return (name, value, { addError }) => {
      // skip require validation for we have used them in @validation
      if (isEmpty(value) || value == null) {
        return;
      }
      const message = getError(value);
      if (message != null) {
        addError(name, { title: info.identifier, message });
      }
    };
  }

  @action
  async submit() {
    if (this.form == null) {
      throw "No form";
    }
    await this.form.submit();
    if (this.serializedData == null) {
      throw new ParamValidationError("validation_failed");
    } else {
      return this.serializedData;
    }
  }

  @action
  onRegisterApi(form) {
    this.form = form;
  }

  @action
  onSubmit(data) {
    this.serializedData = null;
    const serializedData = {};
    for (const [id, val] of Object.entries(data)) {
      serializedData[id] =
        serializeValue(this.infoOf[id].type, val) ?? undefined;
    }
    this.serializedData = serializedData;
  }

  <template>
    <div class="query-params">
      <Form
        @data={{this.data}}
        @onRegisterApi={{this.onRegisterApi}}
        @onSubmit={{this.onSubmit}}
        class="params-form"
        as |form|
      >
        {{#each this.paramInfo as |info|}}
          <div class="param">
            <form.Field
              @name={{info.identifier}}
              @title={{info.identifier}}
              @validation={{info.validation}}
              @validate={{info.validate}}
              as |field|
            >
              <info.component @field={{field}} @info={{info}} />
            </form.Field>
          </div>
        {{/each}}
      </Form>
    </div>
  </template>
}
