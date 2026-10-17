import assert from "node:assert/strict";
import { test } from "node:test";
import { groupContainers } from "./container-groups";

test("Compose labels define groups; standalone containers stay separate from named projects", () => {
  const groups = groupContainers([
    { name: "same-prefix-one", composeProject: "beta", state: "exited", health: "none" },
    { name: "same-prefix-two", composeProject: "alpha", state: "running", health: "healthy" },
    { name: "standalone", composeProject: null, state: "running", health: "unhealthy" },
    { name: "unlabelled", composeProject: "", state: "exited", health: "none" },
    { name: "worker", composeProject: "alpha", state: "running", health: "unhealthy" },
  ]);
  assert.deepEqual(groups.map((group) => [group.project, group.items.length, group.running, group.unhealthy]), [["alpha", 2, 2, 1], ["beta", 1, 0, 0], [null, 2, 1, 1]]);
});

test("live state changes do not reorder groups, and sorting does not mutate input", () => {
  const containers = [
    { name: "z", composeProject: "alpha", state: "exited", health: "none" },
    { name: "a", composeProject: "alpha", state: "running", health: "none" },
    { name: "b", composeProject: "beta", state: "running", health: "none" },
  ];
  assert.deepEqual(groupContainers(containers)[0].items.map((item) => item.name), ["a", "z"]);
  assert.equal(containers[0].name, "z");
  assert.deepEqual(groupContainers(containers.map((item) => ({ ...item, state: "exited" }))).map((group) => group.project), ["alpha", "beta"]);
  assert.deepEqual(groupContainers([]), []);
});
