import { fillIn, render } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import formKit from "discourse/tests/helpers/form-kit-helper";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import I18n from "I18n";

const ERRORS = {
  REQUIRED: I18n.t("form_kit.errors.required"),
  NOT_AN_INTEGER: I18n.t("form_kit.errors.not_an_integer"),
  NOT_A_NUMBER: I18n.t("form_kit.errors.not_a_number"),
  OVERFLOW_HIGH: I18n.t("form_kit.errors.too_high", { count: 2147484647 }),
  OVERFLOW_LOW: I18n.t("form_kit.errors.too_low", { count: -2147484648 }),
  INVALID: I18n.t("explorer.form.errors.invalid"),
};

const InputTestCases = [
  {
    type: "string",
    default: "foo",
    initial: "bar",
    tests: [
      { input: "", data_null: "", error: ERRORS.REQUIRED },
      { input: " ", data_null: " ", error: ERRORS.REQUIRED },
      { input: "str", data: "str" },
    ],
  },
  {
    type: "int",
    default: "123",
    initial: "456",
    tests: [
      { input: "", data_null: "", error: ERRORS.REQUIRED },
      { input: "1234", data: "1234" },
      { input: "0", data: "0" },
      { input: "-2147483648", data: "-2147483648" },
      { input: "2147483649", error: ERRORS.OVERFLOW_HIGH },
      { input: "-2147483649", error: ERRORS.OVERFLOW_LOW },
    ],
  },
  {
    type: "bigint",
    default: "123",
    initial: "456",
    tests: [
      { input: "", data_null: undefined, error: ERRORS.REQUIRED },
      { input: "123", data: "123" },
      { input: "0", data: "0" },
      { input: "-2147483649", data: "-2147483649" },
      { input: "2147483649", data: "2147483649" },
      { input: "abcd", error: ERRORS.NOT_A_NUMBER },
      { input: "114.514", error: ERRORS.NOT_AN_INTEGER },
    ],
  },
  {
    type: "category_id",
    default: "4",
    initial: "3",
    tests: [
      {
        input: null,
        data_null: undefined,
        error: ERRORS.REQUIRED,
      },
      {
        input: async () => {
          const categoryChooser = selectKit(".category-chooser");

          await categoryChooser.expand();
          await categoryChooser.selectRowByValue(2);
        },
        data: "2",
      },
    ],
  },
];

module("Data Explorer Plugin | Component | param-input", function (hooks) {
  setupRenderingTest(hooks);

  for (const testcase of InputTestCases) {
    for (const config of [
      { default: testcase.default },
      { nullable: false, initial: testcase.initial },
      { nullable: false, default: testcase.default, initial: testcase.initial },
      { nullable: true },
    ]) {
      const testName = ["type"];
      if (config.nullable) {
        testName.push("nullable");
      }
      testName.push(testcase.type);
      if (config.initial) {
        testName.push("with initial value");
      }
      if (config.initial) {
        testName.push("with default");
      }

      test(testName.join(" "), async function (assert) {
        this.setProperties({
          param_info: [
            {
              identifier: testcase.type,
              type: testcase.type,
              default: config.default ?? null,
              nullable: config.nullable,
            },
          ],
          initialValues: config.initial
            ? { [testcase.type]: config.initial }
            : {},
          onRegisterApi: ({ submit }) => {
            this.submit = submit;
          },
        });

        await render(hbs`
        <ParamInputForm
          @hasParams=true
          @initialValues={{this.initialValues}}
          @paramInfo={{this.param_info}}
          @onRegisterApi={{this.onRegisterApi}}
        />`);

        if (config.initial || config.default) {
          const data = await this.submit();
          const val = config.initial || config.default;
          assert.strictEqual(
            data[testcase.type],
            val,
            `has initial/default value "${val}"`
          );
        }

        for (const t of testcase.tests) {
          if (t.input == null && (config.initial || config.default)) {
            continue;
          }
          await formKit().reset();
          if (t.input != null) {
            if (typeof t.input === "function") {
              await t.input();
            } else {
              await fillIn(`[name="${testcase.type}"]`, t.input);
            }
          }

          if (config.nullable && "data_null" in t) {
            const data = await this.submit();
            assert.strictEqual(
              data[testcase.type],
              t.data_null,
              `should have null data`
            );
          } else if (t.error) {
            await formKit().submit();
            assert.form().field(testcase.type).hasError(t.error);
          } else {
            const data = await this.submit();
            assert.strictEqual(
              data[testcase.type],
              t.data,
              `data should be "${t.data}"`
            );
          }
        }
      });
    }
  }

  test("empty form will reject submit", async function (assert) {
    this.setProperties({
      param_info: [
        {
          identifier: "string",
          type: "string",
          default: null,
          nullable: false,
        },
      ],
      initialValues: {},
      onRegisterApi: ({ submit }) => {
        this.submit = submit;
      },
    });

    await render(hbs`
    <ParamInputForm
      @initialValues={{this.initialValues}}
      @paramInfo={{this.param_info}}
      @onRegisterApi={{this.onRegisterApi}}
    />`);

    assert.rejects(this.submit());

    // After successfully submitting the test once, edit and submit again.
    await fillIn(`[name="string"]`, "foo");
    await this.submit();
    await fillIn(`[name="string"]`, "");
    assert.rejects(this.submit());
  });
});
