import {
  acceptance,
  exists,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { clearPopupMenuOptionsCallback } from "discourse/controllers/composer";
import I18n from "I18n";

acceptance("Data Explorer Plugin | List Queries", function (needs) {
  needs.user();
  needs.settings({ data_explorer_enabled: true });
  needs.hooks.beforeEach(() => {
    clearPopupMenuOptionsCallback();
  });

  needs.pretender((server, helper) => {
    server.get("/admin/plugins/explorer/groups.json", () => {
      return helper.response([
        {
          id: 1,
          name: "admins",
        },
        {
          id: 2,
          name: "moderators",
        },
        {
          id: 3,
          name: "staff",
        },
        {
          id: 0,
          name: "everyone",
        },
        {
          id: 10,
          name: "trust_level_0",
        },
        {
          id: 11,
          name: "trust_level_1",
        },
        {
          id: 12,
          name: "trust_level_2",
        },
        {
          id: 13,
          name: "trust_level_3",
        },
        {
          id: 14,
          name: "trust_level_4",
        },
      ]);
    });

    server.get("/admin/plugins/explorer/schema.json", () => {
      return helper.response({
        anonymous_users: [
          {
            column_name: "id",
            data_type: "serial",
            primary: true,
          },
          {
            column_name: "user_id",
            data_type: "integer",
            fkey_info: "users",
          },
          {
            column_name: "master_user_id",
            data_type: "integer",
            fkey_info: "users",
          },
          {
            column_name: "active",
            data_type: "boolean",
          },
          {
            column_name: "created_at",
            data_type: "timestamp",
          },
          {
            column_name: "updated_at",
            data_type: "timestamp",
          },
        ],
      });
    });

    server.get("/admin/plugins/explorer/queries", () => {
      return helper.response({
        queries: [
          {
            id: -5,
            sql:
              "-- [params]\n-- int :months_ago = 1\n\nWITH query_period AS\n(SELECT date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' AS period_start,\n                                                    date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' + INTERVAL '1 month' - INTERVAL '1 second' AS period_end)\nSELECT t.id AS topic_id,\n    t.category_id,\n    COUNT(p.id) AS reply_count\nFROM topics t\nJOIN posts p ON t.id = p.topic_id\nJOIN query_period qp ON p.created_at >= qp.period_start\nAND p.created_at <= qp.period_end\nWHERE t.archetype = 'regular'\nAND t.user_id > 0\nGROUP BY t.id\nORDER BY COUNT(p.id) DESC, t.score DESC\nLIMIT 100\n",
            name: "Top 100 Active Topics",
            description:
              "based on the number of replies, it accepts a ‘months_ago’ parameter, defaults to 1 to give results for the last calendar month.",
            param_info: [
              {
                identifier: "months_ago",
                type: "int",
                default: "1",
                nullable: false,
              },
            ],
            created_at: "2021-02-05T16:42:45.572Z",
            username: "system",
            group_ids: [],
            last_run_at: "2021-02-08T15:37:49.188Z",
            hidden: false,
            user_id: -1,
          },
          {
            id: -6,
            sql:
              "-- [params]\n-- int :months_ago = 1\n\nWITH query_period AS (\n    SELECT\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' as period_start,\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' + INTERVAL '1 month' - INTERVAL '1 second' as period_end\n        )\n\n    SELECT\n        ua.user_id,\n        count(1) AS like_count\n    FROM user_actions ua\n    INNER JOIN query_period qp\n    ON ua.created_at >= qp.period_start\n    AND ua.created_at <= qp.period_end\n    WHERE ua.action_type = 1\n    GROUP BY ua.user_id\n    ORDER BY like_count DESC\n    LIMIT 100\n",
            name: "Top 100 Likers",
            description:
              "returns the top 100 likers for a given monthly period ordered by like_count. It accepts a ‘months_ago’ parameter, defaults to 1 to give results for the last calendar month.",
            param_info: [
              {
                identifier: "months_ago",
                type: "int",
                default: "1",
                nullable: false,
              },
            ],
            created_at: "2021-02-02T12:21:11.449Z",
            username: "system",
            group_ids: [],
            last_run_at: "2021-02-11T08:29:59.337Z",
            hidden: false,
            user_id: -1,
          },
        ],
      });
    });
  });

  test("it renders the page with the list of queries", async function (assert) {
    await visit("admin/plugins/explorer");

    assert.ok(
      query("div.query-list input.ember-text-field").placeholder ===
        I18n.t("explorer.search_placeholder"),
      "the search box was rendered"
    );

    assert.ok(
      exists("div.query-list button.btn-icon svg.d-icon-plus"),
      "the add query button was rendered"
    );

    assert.ok(
      query("div.query-list button.btn-icon-text span.d-button-label")
        .innerText === I18n.t("explorer.import.label"),
      "the import button was rendered"
    );

    assert.ok(
      queryAll("div.container table.recent-queries tbody tr").length === 2,
      "the list of queries was rendered"
    );

    assert.ok(
      query(
        "div.container table.recent-queries tbody tr:nth-child(1) td a"
      ).innerText.startsWith("Top 100 Likers"),
      "The first query was rendered"
    );

    assert.ok(
      query(
        "div.container table.recent-queries tbody tr:nth-child(2) td a"
      ).innerText.startsWith("Top 100 Active Topics"),
      "The second query was rendered"
    );
  });
});
