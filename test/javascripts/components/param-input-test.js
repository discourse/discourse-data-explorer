import { render } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import selectKit from "discourse/tests/helpers/select-kit-helper";

module("Data Explorer Plugin | Component | param-input", function (hooks) {
  setupRenderingTest(hooks);

  test("Renders the categroy_id type correctly", async function (assert) {
    this.setProperties({
      param_info: [
        {
          identifier: "category_id",
          type: "category_id",
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
      @hasParams=true
      @initialValues={{this.initialValues}}
      @paramInfo={{this.param_info}}
      @onRegisterApi={{this.onRegisterApi}}
    />`);

    const categoryChooser = selectKit(".category-chooser");

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(2);

    this.submit().then(({ category_id }) => {
      assert.strictEqual(category_id, "2");
    });
  });
});
