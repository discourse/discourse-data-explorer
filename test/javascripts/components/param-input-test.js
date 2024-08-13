import { render } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import selectKit from "discourse/tests/helpers/select-kit-helper";

const values = {};
function updateParams(identifier, value) {
  values[identifier] = value;
}

module("Data Explorer Plugin | Component | param-input", function (hooks) {
  setupRenderingTest(hooks);

  test("Renders the categroy_id type correctly", async function (assert) {
    this.setProperties({
      info: {
        identifier: "category_id",
        type: "category_id",
        default: null,
        nullable: false,
      },
      initialValues: {},
      params: {},
      updateParams,
    });

    await render(hbs`<ParamInput
      @params={{this.params}}
      @initialValues={{this.initialValues}}
      @info={{this.info}}
      @updateParams={{this.updateParams}}
    />`);

    const categoryChooser = selectKit(".category-chooser");

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(2);

    assert.strictEqual(values.category_id, "2");
  });
});
