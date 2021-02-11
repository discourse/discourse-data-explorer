import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

discourseModule(
  "Data Explorer Plugin | Integration | Component | query-result",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("it renders badge names in query results", {
      template: hbs`{{query-result content=content}}`,

      beforeEach() {
        const results = {
          colrender: { 0: "badge" },
          relations: {
            badge: [
              {
                description: "description",
                icon: "fa-user",
                id: 1,
                name: "badge name",
                displayName: "badge display name",
              },
            ],
          },
          result_count: 1,
          columns: ["badge_id"],
          rows: [[1]],
        };
        this.set("content", results);
      },

      test(assert) {
        assert.ok(
          queryAll(
            "table tbody tr:nth-child(1) td:nth-child(1) span"
          ).text() === "badge display name"
        );
      },
    });
  }
);
