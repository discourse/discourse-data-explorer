import {module, test} from "qunit";
import {setupTest} from "ember-qunit";

module("Data Explorer Plugin | Unit | Component | query-result", function (hooks) {
    setupTest(hooks);

    test("it transforms data for a chart", function (assert) {
      const component = this.owner.lookup('component:query-result');
      component.content = {
        colrender: [],
        result_count: 2,
        columns: ["user", "like_count"],
        rows: [
          ["user1", 10],
          ["user2", 20],
        ],
      };

      assert.deepEqual(
        component.chartLabels,
        ["user1", "user2"],
        "labels are correct"
      );

      assert.deepEqual(component.chartValues, [10, 20], "values are correct");

      assert.deepEqual(
        component.chartDatasetName,
        "like_count",
        "the dataset name is correct"
      );
    });

    test("it uses descriptive chart labels instead of identifiers", function (assert) {
      const component = this.owner.lookup('component:query-result');
      component.content = {
        colrender: {0: "user"},
        relations: {
          user: [
            {id: 1, username: "user1"},
            {id: 2, username: "user2"},
          ],
        },
        result_count: 2,
        columns: ["user", "like_count"],
        rows: [
          [1, 10],
          [2, 20],
        ],
      };

      assert.deepEqual(component.chartLabels, ["user1", "user2"]);
    });

    test("it uses an identifier as a chart label if labelSelector doesn't exist", function (assert) {
      const component = this.owner.lookup('component:query-result');
      component.content = {
        colrender: {0: "unknown_entity"},
        relations: {
          unknown_entity: [
            {id: 1, username: "user1"},
            {id: 2, username: "user2"},
          ],
        },
        result_count: 2,
        columns: ["user", "like_count"],
        rows: [
          [1, 10],
          [2, 20],
        ],
      };

      assert.deepEqual(component.chartLabels, ["1", "2"]);
    });

    test("it cuts too long chart labels", function (assert) {
      const component = this.owner.lookup('component:query-result');
      component.content = {
        colrender: [],
        result_count: 2,
        columns: ["user", "like_count"],
        rows: [
          ["This string is too long to be used as a label on a chart", 10],
          ["This string is too long to be used as a label on a chart", 20],
        ],
      };

      assert.deepEqual(component.chartLabels, [
        "This string is too long t...",
        "This string is too long t...",
      ]);
    });
  }
);
