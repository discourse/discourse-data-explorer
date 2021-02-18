import { moduleFor } from "ember-qunit";
import { test } from "qunit";

moduleFor("component:query-result");

test("it transforms data for a chart", function (assert) {
  const results = {
    colrender: [],
    result_count: 2,
    columns: ["user", "like_count"],
    rows: [
      ["user1", 10],
      ["user2", 20],
    ],
  };
  this.subject().setProperties({
    content: results,
  });

  assert.deepEqual(
    this.subject().chartLabels,
    ["user1", "user2"],
    "labels are correct"
  );

  assert.deepEqual(this.subject().chartValues, [10, 20], "values are correct");

  assert.deepEqual(
    this.subject().chartDatasetName,
    "like_count",
    "the dataset name is correct"
  );
});

test("it uses descriptive chart labels instead of identifiers", function (assert) {
  const results = {
    colrender: { 0: "user" },
    relations: {
      user: [
        { id: 1, username: "user1" },
        { id: 2, username: "user2" },
      ],
    },
    result_count: 2,
    columns: ["user", "like_count"],
    rows: [
      [1, 10],
      [2, 20],
    ],
  };
  this.subject().setProperties({
    content: results,
  });

  assert.deepEqual(this.subject().chartLabels, ["user1", "user2"]);
});

test("it uses an identifier as a chart label if labelSelector doesn't exist", function (assert) {
  const results = {
    colrender: { 0: "unknown_entity" },
    relations: {
      unknown_entity: [
        { id: 1, username: "user1" },
        { id: 2, username: "user2" },
      ],
    },
    result_count: 2,
    columns: ["user", "like_count"],
    rows: [
      [1, 10],
      [2, 20],
    ],
  };
  this.subject().setProperties({
    content: results,
  });

  assert.deepEqual(this.subject().chartLabels, ["1", "2"]);
});

test("it cuts too long chart labels", function (assert) {
  const results = {
    colrender: [],
    result_count: 2,
    columns: ["user", "like_count"],
    rows: [
      ["This string is too long to be used as a label on a chart", 10],
      ["This string is too long to be used as a label on a chart", 20],
    ],
  };
  this.subject().setProperties({
    content: results,
  });

  assert.deepEqual(this.subject().chartLabels, [
    "This string is too long t...",
    "This string is too long t...",
  ]);
});
