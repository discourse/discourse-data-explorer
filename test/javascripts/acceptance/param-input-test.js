import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { click, currentURL, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";

acceptance("Data Explorer Plugin | Param Input", function (needs) {
  needs.user();
  needs.settings({ data_explorer_enabled: true });

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
        {
          id: 41,
          name: "discourse",
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
            id: -6,
            sql: "-- [params]\n-- int :months_ago = 1\n\nWITH query_period AS (\n    SELECT\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' as period_start,\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' + INTERVAL '1 month' - INTERVAL '1 second' as period_end\n        )\n\n    SELECT\n        ua.user_id,\n        count(1) AS like_count\n    FROM user_actions ua\n    INNER JOIN query_period qp\n    ON ua.created_at >= qp.period_start\n    AND ua.created_at <= qp.period_end\n    WHERE ua.action_type = 1\n    GROUP BY ua.user_id\n    ORDER BY like_count DESC\n    LIMIT 100\n",
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
          {
            id: -7,
            sql: "-- [params]\n-- user_id :user\n\nSELECT :user_id\n\n",
            name: "Invalid Query",
            description: "",
            param_info: [
              {
                identifier: "user",
                type: "user_id",
                default: null,
                nullable: false,
              },
            ],
            created_at: "2022-01-14T16:40:05.458Z",
            username: "bianca",
            group_ids: [],
            last_run_at: "2022-01-14T16:47:34.244Z",
            hidden: false,
            user_id: 1,
          },
        ],
      });
    });

    server.put("/admin/plugins/explorer/queries/-6", () => {
      return helper.response({
        success: true,
        errors: [],
        duration: 27.5,
        result_count: 2,
        columns: ["user_id", "like_count"],
        default_limit: 1000,
        relations: {
          user: [
            {
              id: -2,
              username: "discobot",
              name: null,
              avatar_template: "/user_avatar/localhost/discobot/{size}/2_2.png",
            },
            {
              id: 2,
              username: "andrey1",
              name: null,
              avatar_template:
                "/letter_avatar_proxy/v4/letter/a/c0e974/{size}.png",
            },
          ],
        },
        colrender: {
          0: "user",
        },
        rows: [
          [-2, 2],
          [2, 2],
        ],
      });
    });

    server.post("/admin/plugins/explorer/queries/-6/run", () => {
      return helper.response({
        success: true,
        errors: [],
        duration: 27.5,
        result_count: 2,
        params: { months_ago: "1" },
        columns: ["user_id", "like_count"],
        default_limit: 1000,
        relations: {
          user: [
            {
              id: -2,
              username: "discobot",
              name: null,
              avatar_template: "/user_avatar/localhost/discobot/{size}/2_2.png",
            },
            {
              id: 2,
              username: "andrey1",
              name: null,
              avatar_template:
                "/letter_avatar_proxy/v4/letter/a/c0e974/{size}.png",
            },
          ],
        },
        colrender: {
          0: "user",
        },
        rows: [
          [-2, 2],
          [2, 2],
        ],
      });
    });

    server.get("/g/discourse/reports/-8", () => {
      return helper.response({
        query: {
          id: -8,
          sql: "-- [params]\n-- int :months_ago = 1\n\nWITH query_period AS (\n    SELECT\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' as period_start,\n        date_trunc('month', CURRENT_DATE) - INTERVAL ':months_ago months' + INTERVAL '1 month' - INTERVAL '1 second' as period_end\n        )\n\n    SELECT\n        ua.user_id,\n        count(1) AS like_count\n    FROM user_actions ua\n    INNER JOIN query_period qp\n    ON ua.created_at >= qp.period_start\n    AND ua.created_at <= qp.period_end\n    WHERE ua.action_type = 1\n    GROUP BY ua.user_id\n    ORDER BY like_count DESC\n    LIMIT 100\n",
          name: "Top 100 Likers Report",
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
          group_ids: [41],
          last_run_at: "2021-02-11T08:29:59.337Z",
          hidden: false,
          user_id: -1,
        },
      });
    });

    server.post("/admin/plugins/explorer/queries/-7/run", () => {
      return helper.response({
        success: true,
        errors: [],
        duration: 27.5,
        params: { user_id: "null" },
        columns: ["user_id"],
        default_limit: 1000,
        relations: {
          user: [
            {
              id: 2,
              username: "andrey1",
              name: null,
              avatar_template:
                "/letter_avatar_proxy/v4/letter/a/c0e974/{size}.png",
            },
          ],
        },
        colrender: {
          0: "user",
        },
        rows: [],
      });
    });

    server.post("/g/discourse/reports/-8/run", () => {
      return helper.response({
        success: true,
        errors: [],
        duration: 27.5,
        result_count: 2,
        params: { months_ago: "1" },
        columns: ["user_id", "like_count"],
        default_limit: 1000,
        relations: {
          user: [
            {
              id: -2,
              username: "discobot",
              name: null,
              avatar_template: "/user_avatar/localhost/discobot/{size}/2_2.png",
            },
            {
              id: 2,
              username: "andrey1",
              name: null,
              avatar_template:
                "/letter_avatar_proxy/v4/letter/a/c0e974/{size}.png",
            },
          ],
        },
        colrender: {
          0: "user",
        },
        rows: [
          [-2, 2],
          [2, 2],
        ],
      });
    });
  });

  test("it puts params for the query into the url", async function (assert) {
    await visit("admin/plugins/explorer?id=-6");
    const monthsAgoValue = "2";
    await fillIn(".query-params input", monthsAgoValue);
    await click("form.query-run button");

    const searchParams = new URLSearchParams(currentURL());
    const monthsAgoParam = JSON.parse(searchParams.get("params")).months_ago;
    assert.equal(monthsAgoParam, monthsAgoValue);
  });

  test("it loads the page if one of the parameter is null", async function (assert) {
    await visit('admin/plugins/explorer?id=-7&params={"user":null}');
    assert.ok(exists(".query-params .user-chooser"));
    assert.ok(exists(".query-run .btn.btn-primary"));
  });

  test("it applies params when running a report", async function (assert) {
    await visit("/g/discourse/reports/-8");
    const monthsAgoValue = "2";
    await fillIn(".query-params input", monthsAgoValue);
    await click("form.query-run button");
    assert.equal(query(".query-params input").value, monthsAgoValue);
  });
});
