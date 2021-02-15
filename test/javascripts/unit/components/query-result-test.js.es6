import { moduleFor } from "ember-qunit";
import { test } from "qunit";

moduleFor("component:query-result");

test("it transforms data for a graph", function (assert) {
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
    this.subject().graphLabels,
    ["user1", "user2"],
    "labels are correct"
  );

  assert.deepEqual(this.subject().graphValues, [10, 20], "values are correct");

  assert.deepEqual(
    this.subject().graphDatasetName,
    "like_count",
    "the dataset name is correct"
  );
});

test("it uses descriptive graph labels instead of identifiers", function (assert) {
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

  assert.deepEqual(this.subject().graphLabels, ["user1", "user2"]);
});

test("it uses an identifier as a graph label if labelSelector doesn't exist", function (assert) {
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

  assert.deepEqual(this.subject().graphLabels, ["1", "2"]);
});

test("it cuts too long graph labels", function (assert) {
  const results = {
    colrender: [],
    result_count: 2,
    columns: ["user", "like_count"],
    rows: [
      ["This string is too long to be used as a label on a graph", 10],
      ["This string is too long to be used as a label on a graph", 20],
    ],
  };
  this.subject().setProperties({
    content: results,
  });

  assert.deepEqual(this.subject().graphLabels, [
    "This string is too long t...",
    "This string is too long t...",
  ]);
});
