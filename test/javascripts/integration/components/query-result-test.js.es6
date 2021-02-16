import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { click } from "@ember/test-helpers";
import hbs from "htmlbars-inline-precompile";
import I18n from "I18n";

discourseModule(
  "Data Explorer Plugin | Integration | Component | query-result",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("it renders query results", {
      template: hbs`{{query-result content=content}}`,

      beforeEach() {
        const results = {
          colrender: [],
          result_count: 2,
          columns: ["user_name", "like_count"],
          rows: [
            ["user1", 10],
            ["user2", 20],
          ],
        };
        this.set("content", results);
      },

      test(assert) {
        assert.ok(
          queryAll("div.result-info button:nth-child(1) span").text() ===
            I18n.t("explorer.download_json"),
          "it renders the JSON button"
        );

        assert.ok(
          queryAll("div.result-info button:nth-child(2) span").text() ===
            I18n.t("explorer.download_csv"),
          "it renders the CSV button"
        );

        assert.ok(
          queryAll("div.result-info button:nth-child(3) span").text() ===
            I18n.t("explorer.show_graph"),
          "it renders the chart button"
        );

        assert.ok(exists("div.result-about"), "it renders a query summary");

        assert.ok(
          queryAll("table thead tr th:nth-child(1)").text() === "user_name" &&
            queryAll("table thead tr th:nth-child(2)").text() ===
              "like_count" &&
            queryAll("table tbody tr:nth-child(1) td:nth-child(1)").text() ===
              "user1" &&
            queryAll("table tbody tr:nth-child(1) td:nth-child(2)").text() ===
              "10" &&
            queryAll("table tbody tr:nth-child(2) td:nth-child(1)").text() ===
              "user2" &&
            queryAll("table tbody tr:nth-child(2) td:nth-child(2)").text() ===
              "20",
          "it renders a table with data"
        );
      },
    });

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
                display_name: "badge display name",
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

discourseModule(
  "Data Explorer Plugin | Integration | Component | query-result | chart",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("navigation between a table and a chart works", {
      template: hbs`{{query-result content=content}}`,

      beforeEach() {
        const results = {
          colrender: [],
          result_count: 2,
          columns: ["user_name", "like_count"],
          rows: [
            ["user1", 10],
            ["user2", 20],
          ],
        };
        this.set("content", results);
      },

      async test(assert) {
        assert.equal(
          queryAll("div.result-info button:nth-child(3) span").text(),
          I18n.t("explorer.show_graph"),
          "the chart button was rendered"
        );
        assert.ok(exists("table"), "the table was rendered");

        await click("div.result-info button:nth-child(3)");

        assert.equal(
          queryAll("div.result-info button:nth-child(3) span").text(),
          I18n.t("explorer.show_table"),
          "the chart button was changed to the table button"
        );
        assert.ok(
          exists("canvas.chartjs-render-monitor"),
          "the chart was rendered"
        );

        await click("div.result-info button:nth-child(3)");
        assert.equal(
          queryAll("div.result-info button:nth-child(3) span").text(),
          I18n.t("explorer.show_graph"),
          "the table button was changed to the chart button"
        );
        assert.ok(exists("table"), "the table was rendered");
      },
    });

    componentTest(
      "it renders a chart button when data has two columns and numbers in the second column",
      {
        template: hbs`{{query-result content=content}}`,

        beforeEach() {
          const results = {
            colrender: [],
            result_count: 2,
            columns: ["user_name", "like_count"],
            rows: [
              ["user1", 10],
              ["user2", 20],
            ],
          };
          this.set("content", results);
        },

        test(assert) {
          assert.equal(
            queryAll("div.result-info button:nth-child(3) span").text(),
            I18n.t("explorer.show_graph")
          );
        },
      }
    );

    componentTest(
      "it doesn't render a chart button when data contains identifiers in the second column",
      {
        template: hbs`{{query-result content=content}}`,

        beforeEach() {
          const results = {
            colrender: { 1: "user" },
            relations: {
              user: [
                { id: 1, username: "user1" },
                { id: 2, username: "user2" },
              ],
            },
            result_count: 2,
            columns: ["topic_id", "user_id"],
            rows: [
              [1, 10],
              [2, 20],
            ],
          };
          this.set("content", results);
        },

        test(assert) {
          assert.ok(!exists("div.result-info button:nth-child(3)"));
        },
      }
    );

    componentTest(
      "it doesn't render a chart button when data contains one column",
      {
        template: hbs`{{query-result content=content}}`,

        beforeEach() {
          const results = {
            colrender: [],
            result_count: 2,
            columns: ["user_name"],
            rows: [["user1"], ["user2"]],
          };
          this.set("content", results);
        },

        test(assert) {
          assert.ok(!exists("div.result-info button:nth-child(3)"));
        },
      }
    );

    componentTest(
      "it doesn't render a chart button when data contains more than two columns",
      {
        template: hbs`{{query-result content=content}}`,

        beforeEach() {
          const results = {
            colrender: [],
            result_count: 2,
            columns: ["user_name", "like_count", "post_count"],
            rows: [
              ["user1", 10, 1],
              ["user2", 20, 2],
            ],
          };
          this.set("content", results);
        },

        test(assert) {
          assert.ok(!exists("div.result-info button:nth-child(3)"));
        },
      }
    );
  }
);
